export function queryAllDeep(selector: string, root: ParentNode = document): HTMLElement[] {
  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const roots: ParentNode[] = [root];

  while (roots.length > 0) {
    const current = roots.pop()!;
    for (const el of current.querySelectorAll<HTMLElement>(selector)) {
      if (seen.has(el)) continue;
      seen.add(el);
      results.push(el);
    }

    const walker = document.createTreeWalker(current, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node instanceof HTMLElement && node.shadowRoot) {
        roots.push(node.shadowRoot);
      }
      node = walker.nextNode();
    }
  }

  return results;
}

export function queryAllContentEditableDeep(root: ParentNode = document): HTMLElement[] {
  const selectors = [
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[contenteditable="plaintext-only"]',
    "[contenteditable]",
  ];
  const results: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const selector of selectors) {
    for (const el of queryAllDeep(selector, root)) {
      if (!isContentEditable(el) || seen.has(el)) continue;
      seen.add(el);
      results.push(el);
    }
  }

  return results;
}

export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function isContentEditable(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const value = el.getAttribute("contenteditable");
  return value === "true" || value === "" || value === "plaintext-only";
}

export function elementArea(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  return rect.width * rect.height;
}

export function resolveEditableRoot(editor: HTMLElement): HTMLElement {
  if (editor.classList.contains("elementToProof") && isContentEditable(editor)) {
    return editor;
  }

  const inner = editor.querySelector<HTMLElement>(
    '.elementToProof[contenteditable], .elementToProof[contenteditable="true"], .elementToProof[contenteditable=""]'
  );
  if (inner && isContentEditable(inner)) return inner;

  if (isContentEditable(editor)) return editor;

  const anyEditable = editor.querySelector<HTMLElement>(
    '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]'
  );
  if (anyEditable && isContentEditable(anyEditable)) return anyEditable;

  return editor;
}

export function editorsEquivalent(a: HTMLElement, b: HTMLElement): boolean {
  return a === b || a.contains(b) || b.contains(a);
}
