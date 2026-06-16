import { EditorAdapter } from "../../shared/types";

function isContentEditable(el: HTMLElement): boolean {
  return el.isContentEditable || el.getAttribute("contenteditable") === "true";
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

function createContentEditableAdapter(
  id: string,
  hostMatch: () => boolean,
  editorSelector: string,
  anchorSelector?: string
): EditorAdapter {
  return {
    id,
    matches: hostMatch,
    findEditor() {
      const el = document.querySelector<HTMLElement>(editorSelector);
      if (!el || !isContentEditable(el)) return null;
      return el;
    },
    getText: getTextFromNode,
    setText: setTextInNode,
    getSelectionOffsets: getSelectionOffsetsInElement,
    getWidgetAnchor(editor: HTMLElement): HTMLElement {
      if (anchorSelector) {
        const anchor = editor.closest(anchorSelector);
        if (anchor instanceof HTMLElement) return anchor;
        if (editor.parentElement) return editor.parentElement;
      }
      return editor.parentElement ?? editor;
    },
  };
}

export const gmailAdapter: EditorAdapter = createContentEditableAdapter(
  "gmail",
  () => location.hostname === "mail.google.com",
  'div[aria-label="Message Body"], div[aria-label="Message body"], div.editable[contenteditable="true"]',
  ".aoI"
);

export const outlookAdapter: EditorAdapter = createContentEditableAdapter(
  "outlook",
  () =>
    location.hostname === "outlook.live.com" ||
    location.hostname === "outlook.office.com" ||
    location.hostname === "outlook.office365.com",
  'div[aria-label="Message body"], div[role="textbox"][contenteditable="true"]',
  '[role="main"]'
);

export const linkedinAdapter: EditorAdapter = createContentEditableAdapter(
  "linkedin",
  () => location.hostname === "www.linkedin.com",
  '.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]',
  ".share-box, .share-creation-state"
);

export const mediumAdapter: EditorAdapter = createContentEditableAdapter(
  "medium",
  () => location.hostname === "medium.com",
  'div[contenteditable="true"][data-testid], div[contenteditable="true"].graf--p, article div[contenteditable="true"]',
  "article"
);

export const substackAdapter: EditorAdapter = createContentEditableAdapter(
  "substack",
  () => location.hostname.endsWith(".substack.com"),
  '.ProseMirror[contenteditable="true"], div[contenteditable="true"].body',
  ".editor-container, .post-editor"
);

export const adapters: EditorAdapter[] = [
  gmailAdapter,
  outlookAdapter,
  linkedinAdapter,
  mediumAdapter,
  substackAdapter,
];

export function findActiveAdapter(): EditorAdapter | null {
  for (const adapter of adapters) {
    if (!adapter.matches()) continue;
    if (adapter.findEditor()) return adapter;
  }
  return null;
}
