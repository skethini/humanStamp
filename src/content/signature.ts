import {
  HUMANSTAMP_BLOCK_CLASS,
  HUMANSTAMP_COMMENT_PREFIX,
  HUMANSTAMP_METADATA_ATTR,
  HUMANSTAMP_PAYLOAD_ATTR,
  SIGNATURE_LABEL,
  SIGNATURE_PREFIX,
} from "../shared/constants";
import { verifySignedStamp } from "../shared/crypto";
import { normalizeBodyForHash } from "../shared/normalize";
import { resolveEditableRoot } from "./dom";
import {
  formatSignatureLine,
  findSignatureIndex,
  hasSignatureText,
  stripSignatureText,
} from "../shared/settings";
import { SignedStamp } from "../shared/stamp";

export interface AppendSignatureOptions {
  richEditor?: boolean;
}

export interface RemoveSignatureOptions {
  richEditor?: boolean;
}

export function buildSignature(displayName: string): string {
  return `\n\n${formatSignatureLine(displayName)}`;
}

export function stripSignature(text: string): string {
  return stripSignatureText(text);
}

export function hasSignature(text: string): boolean {
  return hasSignatureText(text);
}

export function getBodyText(fullText: string): string {
  return normalizeBodyForHash(stripSignature(fullText));
}

export function encodeStampForTransport(stampJson: string): string {
  const bytes = new TextEncoder().encode(stampJson);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeStampFromTransport(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function parseSignedStamp(encoded: string): SignedStamp | null {
  try {
    return JSON.parse(encoded) as SignedStamp;
  } catch {
    return null;
  }
}

export function editorHasSignature(editor: HTMLElement): boolean {
  const root = resolveEditableRoot(editor);
  const nodes = root === editor ? [editor] : [editor, root];

  for (const node of nodes) {
    if (node.querySelector(`[${HUMANSTAMP_PAYLOAD_ATTR}]`)) return true;
    if (node.querySelector(`[${HUMANSTAMP_METADATA_ATTR}]`)) return true;
    if (node.querySelector(`.${HUMANSTAMP_BLOCK_CLASS}`)) return true;
    if (node.querySelector(".humanstamp-signature")) return true;
    if (hasSignature(node.innerText.replace(/\u00a0/g, " "))) return true;
  }

  return false;
}

export function findSignatureBlocks(root: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];

  for (const el of root.querySelectorAll<HTMLElement>(`.${HUMANSTAMP_BLOCK_CLASS}`)) {
    blocks.push(el);
  }

  for (const el of root.querySelectorAll<HTMLElement>(
    `[${HUMANSTAMP_PAYLOAD_ATTR}], .humanstamp-signature`
  )) {
    if (blocks.some((block) => block.contains(el))) continue;
    blocks.push(el);
  }

  return blocks;
}

export function selectionIntersectsSignature(editor: HTMLElement): boolean {
  const root = resolveEditableRoot(editor);
  const doc = root.ownerDocument;
  if (!doc) return false;

  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  for (const block of findSignatureBlocks(root)) {
    if (range.intersectsNode(block)) return true;
  }

  return false;
}

export function selectionCoversEntireSignature(editor: HTMLElement): boolean {
  const root = resolveEditableRoot(editor);
  const doc = root.ownerDocument;
  if (!doc) return false;

  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const blocks = findSignatureBlocks(root);
  if (blocks.length === 0) return false;

  return blocks.every((block) => {
    try {
      const blockRange = doc.createRange();
      blockRange.selectNodeContents(block);
      return (
        range.compareBoundaryPoints(Range.START_TO_START, blockRange) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, blockRange) >= 0
      );
    } catch {
      return false;
    }
  });
}

export function signatureIsDamaged(editor: HTMLElement): boolean {
  const root = resolveEditableRoot(editor);
  if (extractStampFromEditor(editor)) return false;

  const blocks = findSignatureBlocks(root);
  if (blocks.length > 0) return true;

  const text = root.innerText.replace(/\u00a0/g, " ");
  const idx = findSignatureIndex(text);
  if (idx === -1) return false;

  const signatureLine = text.slice(idx).split("\n")[0]?.trim() ?? "";
  if (signatureLine === SIGNATURE_LABEL) return false;

  if (!signatureLine.startsWith(SIGNATURE_PREFIX)) return true;

  const namePart = signatureLine.slice(SIGNATURE_PREFIX.length).trim();
  return namePart.length === 0;
}

export function extractStampFromEditor(editor: HTMLElement): SignedStamp | null {
  const root = resolveEditableRoot(editor);

  for (const block of findSignatureBlocks(root)) {
    const stamp = extractStampFromNode(block);
    if (stamp) return stamp;
  }

  for (const el of root.querySelectorAll<HTMLElement>(
    `[${HUMANSTAMP_PAYLOAD_ATTR}], .humanstamp-backup`
  )) {
    const stamp = extractStampFromNode(el);
    if (stamp) return stamp;
  }

  return extractStampFromComments(root);
}

export async function verifyEditorSignature(
  editor: HTMLElement,
  bodyText?: string
): Promise<boolean> {
  const stamp = extractStampFromEditor(editor);
  if (!stamp) return false;

  const body = bodyText ?? getBodyTextFromEditor(editor);
  if (!body) return false;

  return verifySignedStamp(stamp, body);
}

function extractStampFromNode(node: HTMLElement): SignedStamp | null {
  const direct = node.getAttribute(HUMANSTAMP_PAYLOAD_ATTR);
  if (direct) {
    const stamp = parseSignedStamp(unescapeAttributePayload(direct));
    if (stamp) return stamp;
  }

  if (node.classList.contains("humanstamp-backup")) {
    return parseBackupStamp(node.textContent?.trim() ?? "");
  }

  for (const el of node.querySelectorAll<HTMLElement>(
    `[${HUMANSTAMP_PAYLOAD_ATTR}], .humanstamp-backup`
  )) {
    const stamp = extractStampFromNode(el);
    if (stamp) return stamp;
  }

  return null;
}

function unescapeAttributePayload(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseBackupStamp(encoded: string): SignedStamp | null {
  if (!encoded) return null;
  try {
    return parseSignedStamp(decodeStampFromTransport(encoded));
  } catch {
    return parseSignedStamp(encoded);
  }
}

function extractStampFromComments(root: HTMLElement): SignedStamp | null {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment;
    if (!comment.data.startsWith(HUMANSTAMP_COMMENT_PREFIX)) continue;

    const encoded = comment.data.slice(HUMANSTAMP_COMMENT_PREFIX.length);
    const stamp = parseBackupStamp(encoded);
    if (stamp) return stamp;
  }

  return null;
}

export function isHistoryInput(inputType: string): boolean {
  return inputType === "historyUndo" || inputType === "historyRedo";
}

export function appendSignedSignature(
  editor: HTMLElement,
  displayName: string,
  stampJson: string,
  options: AppendSignatureOptions = {}
): void {
  const signatureText = formatSignatureLine(displayName);
  const root = resolveEditableRoot(editor);
  const doc = root.ownerDocument;
  if (!doc) return;

  if (options.richEditor) {
    const html = buildSignatureHtml(signatureText, stampJson);
    if (insertSignatureHtml(root, editor, html)) {
      dispatchEditorInput(root);
      return;
    }

    if (insertSignatureNodes(root, editor, signatureText, stampJson)) {
      dispatchEditorInput(root);
      return;
    }
  }

  root.appendChild(buildSignatureNodes(doc, signatureText, stampJson));
  dispatchEditorInput(root);
}

function buildSignatureHtml(signatureText: string, stampJson: string): string {
  const payload = escapeAttribute(stampJson);
  const encoded = encodeStampForTransport(stampJson);
  return (
    `<div class="humanstamp-spacer"><br></div>` +
    `<div class="${HUMANSTAMP_BLOCK_CLASS}" ${HUMANSTAMP_METADATA_ATTR}="v2" contenteditable="false" style="border:none;margin:0;padding:0;background:transparent;-webkit-user-select:all;user-select:all;">` +
    `<span class="humanstamp-signature" ${HUMANSTAMP_PAYLOAD_ATTR}="${payload}">${escapeHtml(signatureText)}</span>` +
    `<!--${HUMANSTAMP_COMMENT_PREFIX}${encoded}-->` +
    `</div>`
  );
}

function buildSignatureNodes(
  doc: Document,
  signatureText: string,
  stampJson: string
): DocumentFragment {
  const fragment = doc.createDocumentFragment();

  const block = doc.createElement("div");
  block.className = HUMANSTAMP_BLOCK_CLASS;
  block.setAttribute(HUMANSTAMP_METADATA_ATTR, "v2");
  block.setAttribute("contenteditable", "false");
  block.style.cssText =
    "border:none;margin:0;padding:0;background:transparent;line-height:normal;-webkit-user-select:all;user-select:all;";

  const visible = doc.createElement("span");
  visible.className = "humanstamp-signature";
  visible.textContent = signatureText;
  visible.setAttribute(HUMANSTAMP_PAYLOAD_ATTR, stampJson);
  block.appendChild(visible);

  block.appendChild(
    doc.createComment(`${HUMANSTAMP_COMMENT_PREFIX}${encodeStampForTransport(stampJson)}`)
  );

  const backup = doc.createElement("span");
  backup.className = "humanstamp-backup";
  backup.setAttribute("aria-hidden", "true");
  backup.style.cssText =
    "font-size:0;line-height:0;width:0;height:0;overflow:hidden;display:inline-block;";
  backup.textContent = encodeStampForTransport(stampJson);
  block.appendChild(backup);

  const spacer = doc.createElement("div");
  spacer.className = "humanstamp-spacer";
  spacer.appendChild(doc.createElement("br"));

  fragment.appendChild(spacer);
  fragment.appendChild(block);
  return fragment;
}

function insertSignatureNodes(
  root: HTMLElement,
  container: HTMLElement,
  signatureText: string,
  stampJson: string
): boolean {
  const doc = root.ownerDocument;
  if (!doc) return false;

  const fragment = buildSignatureNodes(doc, signatureText, stampJson);
  root.focus();

  const selection = doc.getSelection();
  if (selection) {
    const range = doc.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    range.insertNode(fragment);
    return editorHasSignature(container);
  }

  root.appendChild(fragment);
  return editorHasSignature(container);
}

function insertSignatureHtml(
  root: HTMLElement,
  container: HTMLElement,
  html: string
): boolean {
  root.focus();

  const selection = root.ownerDocument.getSelection();
  if (selection) {
    const range = root.ownerDocument.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    if (root.ownerDocument.execCommand("insertHTML", false, html)) {
      return editorHasSignature(container);
    }
  }

  try {
    root.insertAdjacentHTML("beforeend", html);
    if (editorHasSignature(container)) return true;
  } catch {
    // fall through
  }

  return false;
}

function dispatchEditorInput(editor: HTMLElement): void {
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

export function removeSignatureFromEditor(
  editor: HTMLElement,
  options: RemoveSignatureOptions = {}
): void {
  const root = resolveEditableRoot(editor);
  const nodes = root === editor ? [root] : [root, editor];

  for (const node of nodes) {
    removeMarkedSignatureElements(node);
    removeStampComments(node);
  }

  if (editorHasSignature(editor)) {
    removePlainTextSignature(root);
  }

  if (!options.richEditor && editorHasSignature(editor)) {
    const text = root.innerText.replace(/\u00a0/g, " ");
    const stripped = stripSignatureText(text);
    if (stripped !== text) {
      root.innerText = stripped;
    }
  }

  if (options.richEditor) {
    cleanupSignatureArtifacts(root);
  }

  if (!editorHasSignature(editor)) {
    dispatchEditorInput(root);
  }
}

function removeMarkedSignatureElements(root: HTMLElement): void {
  for (const block of [...root.querySelectorAll(`.${HUMANSTAMP_BLOCK_CLASS}`)]) {
    removeElementAndCleanup(block, root);
  }

  const selector = [
    `[${HUMANSTAMP_PAYLOAD_ATTR}]`,
    `[${HUMANSTAMP_METADATA_ATTR}]`,
    ".humanstamp-signature",
    ".humanstamp-backup",
    ".humanstamp-spacer",
  ].join(", ");

  for (const el of [...root.querySelectorAll(selector)]) {
    if (!el.isConnected) continue;
    removeElementAndCleanup(el, root);
  }
}

function cleanupSignatureArtifacts(root: HTMLElement): void {
  removeLegacySpacers(root);
  removeOrphanBackupSpans(root);
  removeStampComments(root);
  cleanupTrailingEmptyBlocks(root);
}

function removeLegacySpacers(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll(".humanstamp-spacer")]) {
    removeElementAndCleanup(el, root);
  }
}

function removeElementAndCleanup(el: Element, root: HTMLElement): void {
  removeAdjacentSignatureArtifacts(el);
  const parent = el.parentElement;
  el.remove();
  if (parent && parent !== root) {
    bubbleCleanupEmptyContainers(parent, root);
  }
}

function bubbleCleanupEmptyContainers(start: HTMLElement, root: HTMLElement): void {
  let current: HTMLElement | null = start;
  while (current && current !== root) {
    if (current.classList.contains(HUMANSTAMP_BLOCK_CLASS)) break;
    if (current.querySelector(`.${HUMANSTAMP_BLOCK_CLASS}, .humanstamp-signature`)) {
      break;
    }

    const text = current.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (text.length > 0 && !text.startsWith(SIGNATURE_PREFIX) && text !== SIGNATURE_LABEL) break;

    const children = [...current.childNodes];
    const onlyEmptyChildren =
      children.length === 0 ||
      children.every((child) => isRemovableEmptyNode(child));

    if (!onlyEmptyChildren && text.length > 0) break;

    const parent = current.parentElement;
    removeAdjacentSignatureArtifacts(current);
    current.remove();
    current = parent;
  }
}

function removeOrphanBackupSpans(root: HTMLElement): void {
  for (const el of [...root.querySelectorAll(".humanstamp-backup, span[aria-hidden='true']")]) {
    const style = el.getAttribute("style") ?? "";
    if (
      el.classList.contains("humanstamp-backup") ||
      /opacity:\s*0\.0?1|font-size:\s*1px|height:\s*1px/.test(style)
    ) {
      removeElementAndCleanup(el, root);
    }
  }
}

function cleanupTrailingEmptyBlocks(root: HTMLElement): void {
  let node: ChildNode | null = root.lastChild;
  while (node) {
    if (isRemovableEmptyNode(node)) {
      const toRemove = node;
      node = node.previousSibling;
      toRemove.remove();
      continue;
    }
    break;
  }
}

function isRemovableEmptyNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return /^\s*$/.test(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return false;

  const el = node as HTMLElement;
  if (el.tagName === "BR") return true;
  if (el.classList.contains(HUMANSTAMP_BLOCK_CLASS)) return false;
  if (el.querySelector(`.${HUMANSTAMP_BLOCK_CLASS}, .humanstamp-signature`)) {
    return false;
  }

  return isEmptyFormattingBlock(el) || el.classList.contains("humanstamp-spacer");
}

function isEmptyFormattingBlock(el: HTMLElement): boolean {
  if (el.tagName === "DIV" || el.tagName === "P") {
    const text = el.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
    if (text.length === 0) return true;
    if (text === SIGNATURE_PREFIX.trim() || text === SIGNATURE_LABEL) return true;
  }
  return false;
}

function removeAdjacentSignatureArtifacts(node: Node): void {
  const prev = node.previousSibling;
  if (prev instanceof HTMLElement && prev.classList.contains("humanstamp-spacer")) {
    prev.remove();
  } else if (prev instanceof HTMLElement && isEmptyFormattingBlock(prev)) {
    prev.remove();
  }
}

function removePlainTextSignature(root: HTMLElement): void {
  const doc = root.ownerDocument;
  if (!doc) return;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const content = node.textContent ?? "";
    const idx = findSignatureIndex(content);
    if (idx === -1) continue;

    node.textContent = content.slice(0, idx).replace(/\s+$/, "");
    removeAdjacentSignatureArtifacts(node);
    return;
  }
}

function removeStampComments(root: HTMLElement): void {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const toRemove: Comment[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Comment;
    if (node.data.startsWith(HUMANSTAMP_COMMENT_PREFIX)) toRemove.push(node);
  }
  toRemove.forEach((node) => node.remove());
}

export function getBodyTextFromEditor(editor: HTMLElement): string {
  const root = resolveEditableRoot(editor);
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      `[${HUMANSTAMP_PAYLOAD_ATTR}], [${HUMANSTAMP_METADATA_ATTR}], .${HUMANSTAMP_BLOCK_CLASS}, .humanstamp-signature, .humanstamp-backup, .humanstamp-spacer`
    )
    .forEach((node) => node.remove());
  removeStampComments(clone);

  const text = clone.innerText.replace(/\u00a0/g, " ");
  return normalizeBodyForHash(stripSignatureText(text));
}
