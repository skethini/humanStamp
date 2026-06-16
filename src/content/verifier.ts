import { verifySignedStamp } from "../shared/crypto";
import { HUMANSTAMP_METADATA_ATTR, SIGNATURE_PREFIX } from "../shared/constants";
import { SignedStamp } from "../shared/stamp";
import { getBodyTextFromEditor } from "./signature";

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
  });
}

async function scanDocument(): Promise<void> {
  const nodes = document.querySelectorAll<HTMLElement>(
    `[${HUMANSTAMP_METADATA_ATTR}="v2"]`
  );

  for (const metadata of nodes) {
    if (metadata.getAttribute(VERIFIED_ATTR)) continue;
    await verifyMetadataNode(metadata);
  }
}

async function verifyMetadataNode(metadata: HTMLElement): Promise<void> {
  const encoded = metadata.getAttribute("data-humanstamp-payload");
  if (!encoded) {
    metadata.setAttribute(VERIFIED_ATTR, "false");
    return;
  }

  let stamp: SignedStamp;
  try {
    stamp = JSON.parse(encoded) as SignedStamp;
  } catch {
    metadata.setAttribute(VERIFIED_ATTR, "false");
    return;
  }

  const container = findContainer(metadata);
  const bodyText = container ? getBodyTextFromEditor(container) : "";
  const valid = await verifySignedStamp(stamp, bodyText);
  metadata.setAttribute(VERIFIED_ATTR, valid ? "true" : "false");

  if (!valid) return;

  const visible = findVisibleSignature(metadata);
  if (visible) {
    visible.title = VERIFIED_TITLE;
    visible.style.cursor = "help";
  }
}

function findContainer(metadata: HTMLElement): HTMLElement | null {
  const selectors = [
    '[role="textbox"]',
    ".a3s",
    ".ii.gt",
    ".ql-editor",
    ".ProseMirror",
    '[aria-label="Message Body"]',
    '[aria-label="Message body"]',
  ];

  for (const selector of selectors) {
    const match = metadata.closest(selector);
    if (match instanceof HTMLElement) return match;
  }

  return metadata.parentElement;
}

function findVisibleSignature(metadata: HTMLElement): HTMLElement | null {
  const prev = metadata.previousElementSibling;
  if (prev instanceof HTMLElement && prev.classList.contains("humanstamp-signature")) {
    return prev;
  }

  const container = metadata.parentElement;
  if (!container) return null;

  for (const node of container.querySelectorAll<HTMLElement>(".humanstamp-signature")) {
    if (node.textContent?.includes(SIGNATURE_PREFIX)) return node;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (text.textContent?.includes(SIGNATURE_PREFIX)) last = text;
  }

  return last?.parentElement ?? null;
}
