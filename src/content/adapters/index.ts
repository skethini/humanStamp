import { EditorAdapter } from "../../shared/types";
import { isGmailHost, isOutlookHost } from "../../shared/sites";

function isContentEditable(el: HTMLElement): boolean {
  return el.isContentEditable || el.getAttribute("contenteditable") === "true";
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getTextFromNode(node: HTMLElement): string {
  return node.innerText.replace(/\u00a0/g, " ");
}

function setTextInNode(node: HTMLElement, text: string): void {
  node.innerText = text;
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

function getSelectionOffsetsInElement(
  root: HTMLElement
): { start: number; end: number } {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { start: 0, end: 0 };
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return { start: 0, end: 0 };
  }

  const preStart = root.ownerDocument.createRange();
  preStart.selectNodeContents(root);
  preStart.setEnd(range.startContainer, range.startOffset);

  const preEnd = root.ownerDocument.createRange();
  preEnd.selectNodeContents(root);
  preEnd.setEnd(range.endContainer, range.endOffset);

  return {
    start: preStart.toString().length,
    end: preEnd.toString().length,
  };
}

function findActiveEditor(selectors: string[]): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  for (const selector of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (!isContentEditable(el) || !isVisible(el)) continue;
      if (candidates.includes(el)) continue;
      candidates.push(el);
    }
  }

  if (candidates.length === 0) return null;

  const focused = candidates.find((el) => el.contains(document.activeElement));
  if (focused) return focused;

  return candidates[candidates.length - 1];
}

const GMAIL_EDITOR_SELECTORS = [
  'div[aria-label="Message Body"][contenteditable="true"]',
  'div[aria-label="Message body"][contenteditable="true"]',
  'div.editable[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][g_editable="true"]',
];

const OUTLOOK_EDITOR_SELECTORS = [
  'div[aria-label="Message body"][contenteditable="true"]',
  'div[role="textbox"][aria-label="Message body"][contenteditable="true"]',
  'div.elementToProof[contenteditable="true"]',
  '[data-testid="rooster-editor"][contenteditable="true"]',
];

export const gmailAdapter: EditorAdapter = {
  id: "gmail",
  matches: isGmailHost,
  findEditor() {
    return findActiveEditor(GMAIL_EDITOR_SELECTORS);
  },
  getText: getTextFromNode,
  setText: setTextInNode,
  getSelectionOffsets: getSelectionOffsetsInElement,
  getWidgetAnchor(editor: HTMLElement): HTMLElement {
    const sendRow = editor.closest("table")?.querySelector(".aoI");
    if (sendRow instanceof HTMLElement) return sendRow;

    const anchor = editor.closest(".aoI, .aYF");
    if (anchor instanceof HTMLElement) return anchor;

    return editor.parentElement ?? editor;
  },
};

export const outlookAdapter: EditorAdapter = {
  id: "outlook",
  matches: isOutlookHost,
  findEditor() {
    return findActiveEditor(OUTLOOK_EDITOR_SELECTORS);
  },
  getText: getTextFromNode,
  setText: setTextInNode,
  getSelectionOffsets: getSelectionOffsetsInElement,
  getWidgetAnchor(editor: HTMLElement): HTMLElement {
    const composeRoot =
      editor.closest('[role="dialog"]') ??
      editor.closest('[data-app-section="ComposeContainer"]') ??
      editor.closest("#ReadingPaneContainerId") ??
      editor.closest('[role="region"]');

    if (composeRoot instanceof HTMLElement) {
      const toolbar = composeRoot.querySelector(
        '[role="toolbar"], [aria-label="Command toolbar"], div[class*="toolbar"]'
      );
      if (toolbar instanceof HTMLElement) return toolbar;

      const send = composeRoot.querySelector('[aria-label="Send"]');
      if (send?.parentElement instanceof HTMLElement) return send.parentElement;

      return composeRoot;
    }

    return editor.parentElement ?? editor;
  },
};

export const adapters: EditorAdapter[] = [gmailAdapter, outlookAdapter];

export function findActiveAdapter(): EditorAdapter | null {
  for (const adapter of adapters) {
    if (!adapter.matches()) continue;
    if (adapter.findEditor()) return adapter;
  }
  return null;
}
