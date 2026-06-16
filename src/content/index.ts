import { findActiveAdapter } from "./adapters";
import { EditorSession } from "./session";
import { startVerificationScanner } from "./verifier";

let activeSession: EditorSession | null = null;
let trackedEditor: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function attachIfNeeded(): void {
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

  if (activeSession && trackedEditor === editor) return;

  detach();
  trackedEditor = editor;
  activeSession = new EditorSession(adapter, editor);
}

function detach(): void {
  if (activeSession) {
    activeSession.destroy();
    activeSession = null;
    trackedEditor = null;
  }
}

function start(): void {
  startVerificationScanner();
  attachIfNeeded();

  if (observer) return;

  observer = new MutationObserver(() => {
    attachIfNeeded();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
