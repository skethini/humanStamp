import { verifySignedStamp } from "../shared/crypto";
import {
  HUMANSTAMP_COMMENT_PREFIX,
  HUMANSTAMP_PAYLOAD_ATTR,
  SIGNATURE_PREFIX,
} from "../shared/constants";
import { extractBodyBeforeSignature } from "../shared/normalize";
import { SignedStamp } from "../shared/stamp";
import {
  decodeStampFromTransport,
  getBodyTextFromEditor,
  parseSignedStamp,
} from "./signature";

const VERIFIED_TITLE = "Verified by HumanStamp";
const VERIFIED_ATTR = "data-humanstamp-verified";

export function startVerificationScanner(): void {
  void scanDocument();

  const observer = new MutationObserver(() => {
    void scanDocument();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

async function scanDocument(): Promise<void> {
  const anchors = findSignatureAnchors();
  for (const anchor of anchors) {
    if (anchor.getAttribute(VERIFIED_ATTR) === "true") continue;
    await verifyAnchor(anchor);
  }
}

function findSignatureAnchors(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const anchors: HTMLElement[] = [];

  const add = (el: HTMLElement | null) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    anchors.push(el);
  };

  for (const el of document.querySelectorAll<HTMLElement>(
    `[${HUMANSTAMP_PAYLOAD_ATTR}]`
  )) {
    add(resolveHoverTarget(el));
  }

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.textContent?.includes(SIGNATURE_PREFIX)) continue;
    add(resolveHoverTarget(text));
  }

  return anchors;
}

function resolveHoverTarget(node: Text | HTMLElement): HTMLElement {
  if (node instanceof HTMLElement) {
    if (node.textContent?.includes(SIGNATURE_PREFIX)) return node;
    return node;
  }

  let el: HTMLElement | null = node.parentElement;
  while (el) {
    if (el.textContent?.includes(SIGNATURE_PREFIX)) {
      if (["SPAN", "P", "DIV", "TD", "A"].includes(el.tagName)) return el;
    }
    if (el.getAttribute("role") === "textbox") break;
    el = el.parentElement;
  }

  return node.parentElement ?? document.body;
}

async function verifyAnchor(anchor: HTMLElement): Promise<void> {
  const stamp = extractStampNear(anchor);
  if (!stamp) {
    anchor.setAttribute(VERIFIED_ATTR, "false");
    return;
  }

  const bodyCandidates = collectBodyCandidates(anchor);
  let valid = false;
  for (const bodyText of bodyCandidates) {
    if (await verifySignedStamp(stamp, bodyText)) {
      valid = true;
      break;
    }
  }

  anchor.setAttribute(VERIFIED_ATTR, valid ? "true" : "false");
  if (!valid) return;

  const hoverTarget = resolveHoverTarget(anchor);
  hoverTarget.title = VERIFIED_TITLE;
  hoverTarget.style.cursor = "help";
  if (hoverTarget !== anchor) {
    anchor.title = VERIFIED_TITLE;
    anchor.style.cursor = "help";
  }
}

function extractStampNear(anchor: HTMLElement): SignedStamp | null {
  const direct = anchor.getAttribute(HUMANSTAMP_PAYLOAD_ATTR);
  if (direct) {
    const stamp = parseSignedStamp(direct);
    if (stamp) return stamp;
  }

  const payloadHost = anchor.closest<HTMLElement>(`[${HUMANSTAMP_PAYLOAD_ATTR}]`);
  if (payloadHost && payloadHost !== anchor) {
    const stamp = parseSignedStamp(payloadHost.getAttribute(HUMANSTAMP_PAYLOAD_ATTR) ?? "");
    if (stamp) return stamp;
  }

  for (const sibling of adjacentNodes(anchor)) {
    if (sibling instanceof HTMLElement) {
      const stamp = parseSignedStamp(sibling.getAttribute(HUMANSTAMP_PAYLOAD_ATTR) ?? "");
      if (stamp) return stamp;

      const backupStamp = parseBackupCarrier(sibling);
      if (backupStamp) return backupStamp;
    }

    if (sibling instanceof Comment) {
      const stamp = parseCommentStamp(sibling);
      if (stamp) return stamp;
    }
  }

  const commentStamp = extractStampFromComments(anchor);
  if (commentStamp) return commentStamp;

  const backupHost = anchor.parentElement?.querySelector(".humanstamp-backup");
  if (backupHost instanceof HTMLElement) {
    const stamp = parseBackupCarrier(backupHost);
    if (stamp) return stamp;
  }

  return null;
}

function parseBackupCarrier(el: HTMLElement): SignedStamp | null {
  if (!el.classList.contains("humanstamp-backup")) return null;
  const encoded = el.textContent?.trim();
  if (!encoded) return null;
  try {
    return parseSignedStamp(decodeStampFromTransport(encoded));
  } catch {
    return parseSignedStamp(encoded);
  }
}

function parseCommentStamp(comment: Comment): SignedStamp | null {
  if (!comment.data.startsWith(HUMANSTAMP_COMMENT_PREFIX)) return null;
  const encoded = comment.data.slice(HUMANSTAMP_COMMENT_PREFIX.length);
  try {
    return parseSignedStamp(decodeStampFromTransport(encoded));
  } catch {
    return parseSignedStamp(encoded);
  }
}

function* adjacentNodes(anchor: HTMLElement): Generator<ChildNode> {
  let prev = anchor.previousSibling;
  let next = anchor.nextSibling;
  for (let i = 0; i < 4 && (prev || next); i++) {
    if (prev) {
      yield prev;
      prev = prev.previousSibling;
    }
    if (next) {
      yield next;
      next = next.nextSibling;
    }
  }
}

function extractStampFromComments(anchor: HTMLElement): SignedStamp | null {
  const root = findContainer(anchor) ?? anchor.parentElement ?? document.body;
  const comments: Comment[] = [];

  const collect = (node: Node) => {
    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_COMMENT);
    while (walker.nextNode()) {
      const comment = walker.currentNode as Comment;
      if (comment.data.startsWith(HUMANSTAMP_COMMENT_PREFIX)) {
        comments.push(comment);
      }
    }
  };

  collect(root);

  const anchorIndex = positionIndex(anchor);
  let best: { distance: number; stamp: SignedStamp } | null = null;

  for (const comment of comments) {
    const stamp = parseCommentStamp(comment);
    if (!stamp) continue;

    const parent = comment.parentElement;
    if (!parent) continue;

    const distance = Math.abs(positionIndex(parent) - anchorIndex);
    if (!best || distance < best.distance) {
      best = { distance, stamp };
    }
  }

  return best?.stamp ?? null;
}

function positionIndex(el: HTMLElement): number {
  const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
  return all.indexOf(el);
}

function collectBodyCandidates(anchor: HTMLElement): string[] {
  const containers = findContainerCandidates(anchor);
  const candidates: string[] = [];

  for (const container of containers) {
    candidates.push(getBodyTextFromEditor(container));
    candidates.push(extractBodyBeforeSignature(container));
  }

  return [...new Set(candidates.filter((text) => text.length > 0))];
}

function findContainerCandidates(anchor: HTMLElement): HTMLElement[] {
  const selectors = [
    '[role="textbox"]',
    '[role="document"]',
    '[role="article"]',
    '[aria-label="Message body"]',
    '[aria-label="Message Body"]',
    ".a3s",
    ".ii.gt",
    ".allowTextSelection",
    ".ReadingPaneContents",
    '[data-app-section="ReadingPane"]',
    ".ql-editor",
    ".ProseMirror",
    "article",
  ];

  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const add = (el: HTMLElement | null) => {
    if (!el || seen.has(el)) return;
    seen.add(el);
    results.push(el);
  };

  for (const selector of selectors) {
    add(anchor.closest<HTMLElement>(selector));
  }

  let parent = anchor.parentElement;
  for (let depth = 0; parent && depth < 8; depth++) {
    add(parent);
    parent = parent.parentElement;
  }

  return results;
}

function findContainer(anchor: HTMLElement): HTMLElement | null {
  return findContainerCandidates(anchor)[0] ?? null;
}
