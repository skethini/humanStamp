import { DEFAULT_SETTINGS } from "../shared/constants";
import { hashContent } from "../shared/crypto";
import { EditorAdapter } from "../shared/types";
import { requestSignedStamp } from "./api";
import { computeEligibility } from "./eligibility";
import { ProvenanceTracker } from "./provenance";
import {
  appendSignedSignature,
  editorHasSignature,
  getBodyText,
  removeSignatureFromEditor,
} from "./signature";
import { HumanStampWidget } from "./widget";

export class EditorSession {
  private adapter: EditorAdapter;
  private editor: HTMLElement;
  private tracker = new ProvenanceTracker();
  private widget: HumanStampWidget | null = null;
  private displayName = DEFAULT_SETTINGS.displayName;
  private signaturePresent = false;
  private boundBeforeInput: (e: Event) => void;
  private boundInput: (e: Event) => void;
  private pollTimer: number | null = null;
  private boundStorageChange: (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) => void;

  constructor(adapter: EditorAdapter, editor: HTMLElement) {
    this.adapter = adapter;
    this.editor = editor;
    this.boundBeforeInput = (e) => this.onBeforeInput(e as InputEvent);
    this.boundInput = () => this.onInput();
    this.boundStorageChange = (changes, area) => {
      if (area !== "sync" || !changes.displayName) return;
      this.displayName =
        typeof changes.displayName.newValue === "string"
          ? changes.displayName.newValue
          : "";
      this.reconcile();
    };
    this.init();
  }

  private async init(): Promise<void> {
    await this.refreshDisplayName();

    chrome.storage.onChanged.addListener(this.boundStorageChange);

    this.editor.addEventListener("beforeinput", this.boundBeforeInput);
    this.editor.addEventListener("input", this.boundInput);

    this.widget = new HumanStampWidget(
      this.adapter.getWidgetAnchor(this.editor),
      () => void this.addSignature()
    );

    this.pollTimer = window.setInterval(() => this.reconcile(), 1500);
    this.reconcile();
  }

  private async refreshDisplayName(): Promise<void> {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    this.displayName = settings.displayName || "";
  }

  private onBeforeInput(event: InputEvent): void {
    const fullText = this.adapter.getText(this.editor);
    const bodyText = getBodyText(fullText);
    const { start, end } = this.adapter.getSelectionOffsets(this.editor);

    const bodyEnd = bodyText.length;
    const clampedStart = Math.min(start, bodyEnd);
    const clampedEnd = Math.min(end, bodyEnd);

    if (event.inputType.startsWith("delete") && !event.data) {
      this.tracker.applyBeforeInput(event.inputType, null, clampedStart, clampedEnd);
      return;
    }

    const data = event.data ?? "";
    if (!data && !event.inputType.startsWith("insert")) return;

    this.tracker.applyBeforeInput(
      event.inputType,
      data,
      clampedStart,
      clampedEnd
    );
  }

  private onInput(): void {
    this.reconcile();
  }

  private reconcile(): void {
    const fullText = this.adapter.getText(this.editor);
    this.signaturePresent = editorHasSignature(this.editor);
    const bodyText = getBodyText(fullText);

    this.tracker.syncFromText(bodyText, "pasted");

    const state = computeEligibility(this.tracker, bodyText);

    if (!state.eligible && this.signaturePresent) {
      this.removeSignature();
      this.signaturePresent = false;
    }

    this.widget?.update(state, this.signaturePresent);
  }

  private async addSignature(): Promise<void> {
    if (editorHasSignature(this.editor)) return;

    const bodyText = getBodyText(this.adapter.getText(this.editor));
    const state = computeEligibility(this.tracker, bodyText);
    if (!state.eligible) return;

    await this.refreshDisplayName();

    try {
      const contentHash = await hashContent(bodyText);
      const stamp = await requestSignedStamp(contentHash);
      appendSignedSignature(
        this.editor,
        this.displayName,
        JSON.stringify(stamp)
      );
      this.signaturePresent = true;
      this.widget?.update(state, true);
    } catch {
      this.widget?.update(state, false);
    }
  }

  private removeSignature(): void {
    if (!editorHasSignature(this.editor)) return;
    removeSignatureFromEditor(this.editor);
  }

  destroy(): void {
    chrome.storage.onChanged.removeListener(this.boundStorageChange);
    this.editor.removeEventListener("beforeinput", this.boundBeforeInput);
    this.editor.removeEventListener("input", this.boundInput);
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
    }
    this.widget?.destroy();
  }
}
