import { DEFAULT_SETTINGS } from "../shared/constants";
import { hashContent } from "../shared/crypto";
import { EditorAdapter, CharacterOrigin, EligibilityState } from "../shared/types";
import { requestSignedStamp, fetchDisplayName } from "./api";
import { resolveDraftIdentity } from "./draft-identity";
import {
  draftStorageKey,
  loadDraftProvenanceWithFallback,
  saveDraftProvenance,
  saveDraftProvenanceNow,
} from "./draft-provenance";
import { computeEligibility } from "./eligibility";
import { ProvenanceTracker } from "./provenance";
import { resolveEditableRoot } from "./dom";
import {
  appendSignedSignature,
  editorHasSignature,
  extractStampFromEditor,
  getBodyTextFromEditor,
  isHistoryInput,
  removeSignatureFromEditor,
  selectionCoversEntireSignature,
  selectionIntersectsSignature,
  signatureIsDamaged,
  verifyEditorSignature,
} from "./signature";
import { HumanStampWidget } from "./widget";
import { canUseExtensionApis } from "../shared/extension-api";

const IDENTITY_RETRY_DELAYS_MS = [300, 800, 2000];

function isPasteInput(inputType: string): boolean {
  return inputType === "insertFromPaste" || inputType.includes("Paste");
}

export class EditorSession {
  private adapter: EditorAdapter;
  private editor: HTMLElement;
  private tracker = new ProvenanceTracker();
  private widget: HumanStampWidget | null = null;
  private displayName = DEFAULT_SETTINGS.displayName;
  private signaturePresent = false;
  private signatureVerified = false;
  private userEditedBody = false;
  private draftStorageKeyCache: string | null = null;
  private busy = false;
  private reconcileScheduled = false;
  private reconciling = false;
  private boundBeforeInput: (e: Event) => void;
  private boundInput: (e: Event) => void;
  private boundPaste: () => void;
  private pollTimer: number | null = null;
  private identityRetryTimers: number[] = [];
  private mutationDebounceTimer: number | null = null;
  private beforeInputHandled = false;
  private pendingFullPaste = false;
  private mutationObserver: MutationObserver | null = null;

  constructor(adapter: EditorAdapter, editor: HTMLElement) {
    this.adapter = adapter;
    this.editor = editor;
    this.boundBeforeInput = (e) => this.onBeforeInput(e as InputEvent);
    this.boundInput = (e) => this.onInput(e);
    this.boundPaste = () => this.onPaste();
    if (!canUseExtensionApis()) return;
    this.init();
  }

  isBusy(): boolean {
    return this.busy;
  }

  private async init(): Promise<void> {
    await this.refreshDisplayName();

    this.editor.addEventListener("beforeinput", this.boundBeforeInput);
    this.editor.addEventListener("input", this.boundInput);
    this.editor.addEventListener("paste", this.boundPaste);

    this.mutationObserver = new MutationObserver(() => {
      if (this.busy) return;
      if (this.mutationDebounceTimer !== null) {
        window.clearTimeout(this.mutationDebounceTimer);
      }
      this.mutationDebounceTimer = window.setTimeout(() => {
        this.mutationDebounceTimer = null;
        this.scheduleReconcile();
      }, 100);
    });
    this.mutationObserver.observe(resolveEditableRoot(this.editor), {
      childList: true,
      subtree: true,
      characterData: true,
    });

    this.widget = new HumanStampWidget(
      this.editor,
      () => void this.addSignature(),
      {
        floating: true,
        positionRef: this.editor,
      }
    );

    await this.bootstrapDraft();
    this.scheduleIdentityRetry();
    this.pollTimer = window.setInterval(() => {
      void this.refreshDisplayName().then(() => this.scheduleReconcile());
    }, 1500);
    this.scheduleReconcile();
  }

  private async bootstrapDraft(): Promise<void> {
    await this.applyStoredProvenance();

    this.signaturePresent = editorHasSignature(this.editor);
    if (this.signaturePresent) {
      const bodyText = this.getEditorBodyText();
      this.signatureVerified = await verifyEditorSignature(this.editor, bodyText);
    }
  }

  private scheduleIdentityRetry(): void {
    for (const delay of IDENTITY_RETRY_DELAYS_MS) {
      const timer = window.setTimeout(() => {
        void this.retryProvenanceIfNeeded();
      }, delay);
      this.identityRetryTimers.push(timer);
    }
  }

  private async retryProvenanceIfNeeded(): Promise<void> {
    if (this.userEditedBody || this.busy) return;

    const bodyText = this.getEditorBodyText();
    if (!bodyText) return;

    const identity = await resolveDraftIdentity(
      this.adapter.id,
      this.editor,
      bodyText
    );
    const key = draftStorageKey(identity);
    if (key === this.draftStorageKeyCache) return;

    const cached = await loadDraftProvenanceWithFallback(identity);
    if (!cached) return;

    this.tracker.setOrigins(cached);
    this.draftStorageKeyCache = key;
    this.scheduleReconcile();
  }

  private getEditorBodyText(): string {
    return getBodyTextFromEditor(this.editor);
  }

  private inferSeedOrigin(): CharacterOrigin {
    return "pasted";
  }

  private async getDraftStorageKey(bodyText: string): Promise<string> {
    const identity = await resolveDraftIdentity(
      this.adapter.id,
      this.editor,
      bodyText
    );
    return draftStorageKey(identity);
  }

  private async applyStoredProvenance(): Promise<void> {
    const bodyText = this.getEditorBodyText();
    if (!bodyText) return;

    const identity = await resolveDraftIdentity(
      this.adapter.id,
      this.editor,
      bodyText
    );
    this.draftStorageKeyCache = draftStorageKey(identity);

    const cached = await loadDraftProvenanceWithFallback(identity);
    if (cached) {
      this.tracker.setOrigins(cached);
      return;
    }

    if (this.tracker.length === 0) {
      this.tracker.syncFromText(bodyText, this.inferSeedOrigin());
    }
  }

  private persistDraftProvenance(bodyText: string): void {
    if (!bodyText || this.tracker.length !== bodyText.length) return;

    void this.getDraftStorageKey(bodyText).then((key) => {
      this.draftStorageKeyCache = key;
      saveDraftProvenance(key, this.tracker.getOrigins(), bodyText);
    });
  }

  private async refreshDisplayName(): Promise<void> {
    const displayName = await fetchDisplayName();
    if (displayName !== null) {
      this.displayName = displayName;
    }
  }

  private scheduleReconcile(): void {
    if (this.reconcileScheduled) return;
    this.reconcileScheduled = true;
    queueMicrotask(() => {
      this.reconcileScheduled = false;
      void this.reconcile();
    });
  }

  private syncTrackerToBody(bodyText: string): void {
    if (bodyText.length < this.tracker.length) {
      this.tracker.setOrigins(this.tracker.getOrigins().slice(0, bodyText.length));
      return;
    }

    if (bodyText.length > this.tracker.length) {
      // Reconcile gaps are never typed — only beforeinput/input may mark typed.
      this.tracker.syncFromText(bodyText, "pasted");
    }
  }

  private syncTrackerAfterPaste(bodyText: string): void {
    const wasEmpty = this.tracker.length === 0;

    if (this.pendingFullPaste || wasEmpty || bodyText.length < this.tracker.length) {
      this.tracker.reset();
      this.tracker.syncFromText(bodyText, "pasted");
      this.pendingFullPaste = false;
      return;
    }

    this.tracker.syncFromText(bodyText, "pasted");
  }

  private onPaste(): void {
    this.markUserEditedBody();
    queueMicrotask(() => {
      this.syncTrackerAfterPaste(this.getEditorBodyText());
      this.scheduleReconcile();
    });
  }

  private markUserEditedBody(): void {
    this.userEditedBody = true;
  }

  private resyncTrackerAfterHistory(): void {
    this.markUserEditedBody();
    const bodyText = this.getEditorBodyText();
    if (bodyText.length === this.tracker.length) return;

    this.tracker.reset();
    this.tracker.syncFromText(bodyText, "typed");
  }

  private handleSignatureBeforeInput(event: InputEvent): boolean {
    if (!editorHasSignature(this.editor) && !signatureIsDamaged(this.editor)) {
      return false;
    }

    if (signatureIsDamaged(this.editor)) {
      this.removeSignature();
      this.signaturePresent = false;
      this.signatureVerified = false;
      this.scheduleReconcile();
      return false;
    }

    if (!selectionIntersectsSignature(this.editor)) {
      return false;
    }

    const isDelete =
      event.inputType.startsWith("delete") ||
      event.inputType === "insertReplacementText";
    const isInsert =
      event.inputType.startsWith("insert") && event.inputType !== "insertLineBreak";

    if (isInsert) {
      event.preventDefault();
      return true;
    }

    if (isDelete && !selectionCoversEntireSignature(this.editor)) {
      event.preventDefault();
      return true;
    }

    return false;
  }

  private onBeforeInput(event: InputEvent): void {
    if (this.handleSignatureBeforeInput(event)) {
      return;
    }

    this.markUserEditedBody();
    this.beforeInputHandled = true;

    const bodyText = this.getEditorBodyText();
    const { start, end } = this.adapter.getSelectionOffsets(this.editor);

    const bodyEnd = bodyText.length;
    const clampedStart = Math.min(start, bodyEnd);
    const clampedEnd = Math.min(end, bodyEnd);

    if (event.inputType.startsWith("delete") && !event.data) {
      this.tracker.applyBeforeInput(event.inputType, null, clampedStart, clampedEnd);
      return;
    }

    const data = event.data ?? "";

    if (isPasteInput(event.inputType)) {
      if (clampedStart === 0 && clampedEnd >= bodyEnd && bodyEnd > 0) {
        this.pendingFullPaste = true;
      }
      if (clampedEnd > clampedStart) {
        this.tracker.applyBeforeInput(event.inputType, null, clampedStart, clampedEnd);
      }
      if (!data) return;
    }

    if (!data && !event.inputType.startsWith("insert")) return;

    this.tracker.applyBeforeInput(
      event.inputType,
      data,
      clampedStart,
      clampedEnd
    );
  }

  private onInput(event: Event): void {
    if (!(event instanceof InputEvent)) {
      this.beforeInputHandled = false;
      this.scheduleReconcile();
      return;
    }

    if (isHistoryInput(event.inputType)) {
      this.resyncTrackerAfterHistory();
    } else if (isPasteInput(event.inputType)) {
      this.markUserEditedBody();
      this.syncTrackerAfterPaste(this.getEditorBodyText());
    } else if (this.adapter.needsInputProvenanceFallback) {
      this.markUserEditedBody();
      const bodyText = this.getEditorBodyText();

      if (!this.beforeInputHandled && bodyText.length > this.tracker.length) {
        this.tracker.syncFromText(bodyText, "typed");
      }
    }

    this.beforeInputHandled = false;
    this.scheduleReconcile();
  }

  private updateWidget(state: EligibilityState): void {
    this.widget?.updatePositionRef(this.editor);
    this.widget?.update(state, this.signaturePresent, this.signatureVerified);
  }

  private async reconcile(): Promise<void> {
    if (this.busy || this.reconciling) return;
    this.reconciling = true;

    try {
      if (signatureIsDamaged(this.editor)) {
        this.removeSignature();
        this.signaturePresent = false;
        this.signatureVerified = false;
      }

      this.signaturePresent = editorHasSignature(this.editor);
      const bodyText = this.getEditorBodyText();

      this.syncTrackerToBody(bodyText);

      const state = computeEligibility(this.tracker, bodyText);

      if (this.signaturePresent) {
        const verified = await verifyEditorSignature(this.editor, bodyText);
        this.signatureVerified = verified;

        if (this.userEditedBody && !verified) {
          this.removeSignature();
          this.signaturePresent = false;
          this.signatureVerified = false;
        }
      } else {
        this.signatureVerified = false;
      }

      this.updateWidget(state);
      this.persistDraftProvenance(bodyText);
    } finally {
      this.reconciling = false;
    }
  }

  private async addSignature(): Promise<void> {
    if (this.busy) return;

    if (editorHasSignature(this.editor)) {
      this.widget?.showError("Signature already present");
      return;
    }

    const bodyText = this.getEditorBodyText();
    const state = computeEligibility(this.tracker, bodyText);
    if (!state.eligible) {
      this.widget?.showError("Not eligible yet — keep typing");
      return;
    }

    this.busy = true;
    this.widget?.showLoading();

    await this.refreshDisplayName();

    try {
      const contentHash = await hashContent(bodyText);
      const stamp = await requestSignedStamp(contentHash);
      appendSignedSignature(this.editor, this.displayName, JSON.stringify(stamp));

      if (!editorHasSignature(this.editor) || !extractStampFromEditor(this.editor)) {
        throw new Error("Could not insert signature into editor");
      }

      const verified = await verifyEditorSignature(this.editor, bodyText);
      if (!verified) {
        this.removeSignature();
        throw new Error("Signature could not be verified after insertion");
      }

      this.signaturePresent = true;
      this.signatureVerified = true;
      this.persistDraftProvenance(bodyText);
      this.updateWidget(state);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Signing failed";
      const isConnectionError =
        message.includes("Could not reach the signing service") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("network error") ||
        message.includes("Receiving end does not exist");
      this.widget?.showError(
        isConnectionError
          ? "Could not reach the HumanStamp signing service"
          : message
      );
      this.scheduleReconcile();
    } finally {
      this.busy = false;
    }
  }

  private removeSignature(): void {
    if (!editorHasSignature(this.editor)) return;
    removeSignatureFromEditor(this.editor, { richEditor: true });
  }

  destroy(): void {
    if (this.busy) return;

    const bodyText = this.getEditorBodyText();
    if (bodyText && this.tracker.length === bodyText.length) {
      void this.getDraftStorageKey(bodyText).then((key) =>
        saveDraftProvenanceNow(key, this.tracker.getOrigins(), bodyText)
      );
    }

    for (const timer of this.identityRetryTimers) {
      window.clearTimeout(timer);
    }
    this.identityRetryTimers = [];

    if (this.mutationDebounceTimer !== null) {
      window.clearTimeout(this.mutationDebounceTimer);
    }

    this.editor.removeEventListener("beforeinput", this.boundBeforeInput);
    this.editor.removeEventListener("input", this.boundInput);
    this.editor.removeEventListener("paste", this.boundPaste);
    this.mutationObserver?.disconnect();
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
    }
    this.widget?.destroy();
  }
}
