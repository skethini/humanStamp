import { EditorAdapter } from "../../shared/types";
import { isBlankComposeFrame, isGmailHost, isOutlookHost } from "../../shared/sites";
import {
  elementArea,
  isContentEditable,
  isVisible,
  queryAllDeep,
  resolveEditableRoot,
} from "../dom";

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

function findActiveEditor(
  selectors: string[],
  filter?: (el: HTMLElement) => boolean
): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  for (const selector of selectors) {
    for (const el of queryAllDeep(selector)) {
      if (!isContentEditable(el) || !isVisible(el)) continue;
      if (filter && !filter(el)) continue;
      if (candidates.includes(el)) continue;
      candidates.push(el);
    }
  }

  return pickBestEditor(candidates);
}

function pickBestEditor(candidates: HTMLElement[]): HTMLElement | null {
  if (candidates.length === 0) return null;

  const activeEl = document.activeElement;
  const focused = candidates.find(
    (el) =>
      el === activeEl ||
      el.contains(activeEl) ||
      activeEl?.shadowRoot?.contains(el)
  );
  if (focused) return focused;

  const labeled = candidates.find((el) => hasMessageBodyLabel(el));
  if (labeled) return labeled;

  return candidates.sort((a, b) => elementArea(b) - elementArea(a))[0];
}

export function hasMessageBodyLabel(el: HTMLElement): boolean {
  const label = (el.getAttribute("aria-label") ?? "").toLowerCase();
  return label.includes("message body");
}

function isOutlookRecipientField(el: HTMLElement): boolean {
  const label = (el.getAttribute("aria-label") ?? "").toLowerCase();
  if (label === "to" || label === "cc" || label === "bcc") return true;
  if (label.includes("add a subject")) return true;
  if (label.includes("recipients")) return true;
  return false;
}

function isOutlookReplyContext(el: HTMLElement): boolean {
  return !!(
    el.closest("#ReadingPaneContainerId") ||
    el.closest('[data-app-section="ReadingPane"]') ||
    el.closest('[aria-label*="Reply" i]') ||
    el.closest('[aria-label*="Forward" i]') ||
    el.closest('[aria-label*="Re:" i]')
  );
}

function isOutlookComposeContext(el: HTMLElement): boolean {
  return !!(
    el.closest('[role="dialog"]') ||
    el.closest('[data-app-section="ComposeContainer"]') ||
    el.closest('[data-app-section="Compose"]') ||
    el.closest('[aria-label*="New message" i]') ||
    el.closest('[aria-label*="New mail" i]') ||
    el.closest('[aria-label*="Compose" i]') ||
    el.closest("#ReadingPaneContainerId") ||
    el.closest('[class*="ComposeForm"]') ||
    el.closest('[class*="compose"]') ||
    isOutlookReplyContext(el)
  );
}

export function isOutlookMessageBodyEditor(el: HTMLElement): boolean {
  if (isOutlookRecipientField(el)) return false;
  if (hasMessageBodyLabel(el)) return true;

  if (el.classList.contains("elementToProof")) {
    const rect = el.getBoundingClientRect();
    const minHeight = isOutlookReplyContext(el) ? 40 : 80;
    if (rect.height < minHeight) return false;
    return (
      isOutlookComposeContext(el) ||
      !!el.closest('[aria-label*="Message body" i]')
    );
  }

  return false;
}

const GMAIL_EDITOR_SELECTORS = [
  'div[aria-label="Message Body"][contenteditable="true"]',
  'div[aria-label="Message body"][contenteditable="true"]',
  'div[aria-label*="Message Body" i][contenteditable="true"]',
  'div.editable[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][g_editable="true"]',
  'div[contenteditable="true"][role="textbox"]',
];

function isGmailQuotedContent(el: HTMLElement): boolean {
  if (hasMessageBodyLabel(el) || el.getAttribute("g_editable") === "true") {
    return false;
  }
  return !!el.closest(".gmail_quote, blockquote");
}

function isGmailReplyContext(el: HTMLElement): boolean {
  return !!(
    el.closest(".Am, .Ar, .btm") ||
    el.closest("[data-compose-id]") ||
    el.closest('[aria-label*="Reply" i]') ||
    el.closest('[aria-label*="Forward" i]')
  );
}

function isGmailComposeEditor(el: HTMLElement): boolean {
  if (isGmailQuotedContent(el)) return false;
  if (hasMessageBodyLabel(el)) return true;
  if (el.getAttribute("g_editable") === "true") return true;
  if (el.getAttribute("role") === "textbox" && isGmailReplyContext(el)) {
    return true;
  }
  return !!(
    el.closest(".AD, .iN, .M9, .btC") ||
    isGmailReplyContext(el) ||
    el.closest("[role='dialog']") ||
    el.closest("form.bAs")
  );
}

const OUTLOOK_MESSAGE_BODY_SELECTORS = [
  'div[aria-label="Message body"]',
  'div[aria-label="Message Body"]',
  'div[role="textbox"][aria-label="Message body"]',
  'div[role="textbox"][aria-label="Message Body"]',
  'div.elementToProof[aria-label*="Message body" i]',
  'div.elementToProof[aria-label*="Message Body" i]',
];

const OUTLOOK_COMPOSE_BODY_SELECTORS = ["div.elementToProof"];

export const gmailAdapter: EditorAdapter = {
  id: "gmail",
  matches: isGmailHost,
  usesFloatingWidget: true,
  needsInputProvenanceFallback: false,
  findEditor() {
    return findActiveEditor(GMAIL_EDITOR_SELECTORS, isGmailComposeEditor);
  },
  getText: getTextFromNode,
  setText: setTextInNode,
  getSelectionOffsets: getSelectionOffsetsInElement,
  getWidgetAnchor(editor: HTMLElement): HTMLElement {
    const composeRoot = editor.closest<HTMLElement>(".AD, .iN, form");

    const sendRow =
      editor.closest("table")?.querySelector<HTMLElement>(".aoI") ??
      composeRoot?.querySelector<HTMLElement>(".aoI, .btC");
    if (sendRow) return sendRow;

    const anchor = editor.closest<HTMLElement>(".aoI, .aYF, .btC");
    if (anchor) return anchor;

    return editor.parentElement ?? editor;
  },
};

export const outlookAdapter: EditorAdapter = {
  id: "outlook",
  matches: isOutlookHost,
  usesFloatingWidget: true,
  needsInputProvenanceFallback: true,
  findEditor() {
    const labeled = findActiveEditor(
      OUTLOOK_MESSAGE_BODY_SELECTORS,
      (el) => isOutlookMessageBodyEditor(el)
    );
    if (labeled) return resolveEditableRoot(labeled);

    const fallback = findActiveEditor(OUTLOOK_COMPOSE_BODY_SELECTORS, (el) => {
      if (isOutlookRecipientField(el)) return false;
      const rect = el.getBoundingClientRect();
      const minHeight = isOutlookReplyContext(el) ? 40 : 100;
      return rect.height >= minHeight && isOutlookComposeContext(el);
    });
    return fallback ? resolveEditableRoot(fallback) : null;
  },
  getText: getTextFromNode,
  setText: setTextInNode,
  getSelectionOffsets: getSelectionOffsetsInElement,
  getWidgetAnchor(editor: HTMLElement): HTMLElement {
    return editor;
  },
};

export const adapters: EditorAdapter[] = [outlookAdapter, gmailAdapter];

export function findActiveAdapter(): EditorAdapter | null {
  const candidates = isBlankComposeFrame()
    ? adapters
    : adapters.filter((adapter) => adapter.matches());

  for (const adapter of candidates) {
    const editor = adapter.findEditor();
    if (editor) return adapter;
  }

  return null;
}
