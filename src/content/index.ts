import { findActiveAdapter } from "./adapters";
import { EditorSession } from "./session";
import { startVerificationScanner } from "./verifier";
import { editorsEquivalent } from "./dom";
import { isSupportedMailHost } from "../shared/sites";

let activeSession: EditorSession | null = null;
let trackedEditor: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function attachIfNeeded(): void {
  if (activeSession?.isBusy()) return;

  const adapter = findActiveAdapter();
  if (!adapter) {
    detach();
    return;
  }

  const editor = adapter.findEditor();
  if (!editor) {
    detach();
    return;
  }

  if (
    activeSession &&
    trackedEditor &&
    editorsEquivalent(trackedEditor, editor)
  ) {
    return;
  }

  detach();
  trackedEditor = editor;
  activeSession = new EditorSession(adapter, editor);
}

function detach(): void {
  if (activeSession?.isBusy()) return;

  if (activeSession) {
    activeSession.destroy();
    activeSession = null;
    trackedEditor = null;
  }
}

function start(): void {
  if (!isSupportedMailHost()) return;

  startVerificationScanner();
  attachIfNeeded();

  document.addEventListener("focusin", attachIfNeeded, true);

  if (observer) return;

  observer = new MutationObserver(() => {
    attachIfNeeded();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.setInterval(attachIfNeeded, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
