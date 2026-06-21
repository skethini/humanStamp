import { EligibilityState } from "../shared/types";

const EDGE_PADDING = 8;
const MIN_FLOATING_EDITOR_HEIGHT = 40;

export interface WidgetOptions {
  positionRef?: HTMLElement;
  /** When false, widget is injected inline next to the send row (legacy). */
  floating?: boolean;
}

interface RelativePosition {
  relX: number;
  relY: number;
}

export class HumanStampWidget {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private container: HTMLElement;
  private statusEl: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private onAddSignature: () => void;
  private anchor: HTMLElement;
  private positionRef: HTMLElement | null;
  private floating: boolean;
  private boundReposition: () => void;
  private boundDragMove: (event: MouseEvent) => void;
  private boundDragEnd: () => void;
  private ready = false;
  private dragPosition: RelativePosition | null = null;
  private userPositioned = false;
  private dragging = false;
  private dragOrigin: RelativePosition & { pointerX: number; pointerY: number } =
    { relX: 0, relY: 0, pointerX: 0, pointerY: 0 };

  constructor(
    anchor: HTMLElement,
    onAddSignature: () => void,
    options: WidgetOptions = {}
  ) {
    this.onAddSignature = onAddSignature;
    this.anchor = anchor;
    this.positionRef = options.positionRef ?? anchor;
    this.floating = options.floating ?? true;

    this.host = document.createElement("div");
    this.host.className = "humanstamp-widget-host";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = WIDGET_STYLES;
    this.shadow.appendChild(style);

    this.container = document.createElement("div");
    this.container.className = "humanstamp-widget";
    this.container.innerHTML = `
      <button class="humanstamp-drag-handle" type="button" data-drag-handle aria-label="Drag HumanStamp widget">⠿</button>
      <div class="humanstamp-brand">HumanStamp</div>
      <div class="humanstamp-status" data-status>○ Not Yet Eligible</div>
      <button class="humanstamp-action" type="button" hidden>Add Signature</button>
    `;

    this.shadow.appendChild(this.container);
    this.statusEl = this.container.querySelector("[data-status]")!;
    this.actionBtn = this.container.querySelector(".humanstamp-action")!;
    this.actionBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onAddSignature();
    });

    const dragHandle = this.container.querySelector("[data-drag-handle]")!;
    dragHandle.addEventListener("mousedown", (event) =>
      this.onDragStart(event as MouseEvent)
    );

    this.boundReposition = () => this.reposition();
    this.boundDragMove = (event) => this.onDragMove(event);
    this.boundDragEnd = () => this.onDragEnd();

    if (this.floating) {
      document.body.appendChild(this.host);
      this.host.style.visibility = "hidden";
      window.addEventListener("scroll", this.boundReposition, true);
      window.addEventListener("resize", this.boundReposition);
    } else {
      this.mountInline();
    }

    this.reposition();
  }

  updatePositionRef(editor: HTMLElement): void {
    this.positionRef = editor;
    if (this.floating) this.reposition();
  }

  private mountInline(): void {
    this.anchor.appendChild(this.host);
    this.host.style.visibility = "visible";
  }

  private getEditorRect(): DOMRect | null {
    if (!this.positionRef) return null;
    const rect = this.positionRef.getBoundingClientRect();
    if (rect.width <= 0 || rect.height < MIN_FLOATING_EDITOR_HEIGHT) return null;
    return rect;
  }

  private getWidgetSize(): { width: number; height: number } {
    const rect = this.host.getBoundingClientRect();
    return {
      width: rect.width || this.host.offsetWidth || 280,
      height: rect.height || this.host.offsetHeight || 40,
    };
  }

  private clampRelativePosition(
    relX: number,
    relY: number,
    editorRect: DOMRect,
    widgetSize: { width: number; height: number }
  ): RelativePosition {
    const minX = EDGE_PADDING;
    const minY = EDGE_PADDING;
    const maxX = Math.max(minX, editorRect.width - widgetSize.width - EDGE_PADDING);
    const maxY = Math.max(minY, editorRect.height - widgetSize.height - EDGE_PADDING);

    return {
      relX: Math.min(Math.max(relX, minX), maxX),
      relY: Math.min(Math.max(relY, minY), maxY),
    };
  }

  private defaultRelativePosition(
    editorRect: DOMRect,
    widgetSize: { width: number; height: number }
  ): RelativePosition {
    return this.clampRelativePosition(
      EDGE_PADDING,
      editorRect.height - widgetSize.height - EDGE_PADDING,
      editorRect,
      widgetSize
    );
  }

  private applyPosition(editorRect: DOMRect, rel: RelativePosition): void {
    this.host.style.position = "fixed";
    this.host.style.left = `${editorRect.left + rel.relX}px`;
    this.host.style.top = `${editorRect.top + rel.relY}px`;
    this.host.style.zIndex = "2147483647";
  }

  private reposition(): void {
    if (!this.floating) {
      if (!this.anchor.isConnected) {
        this.host.style.visibility = "hidden";
        this.ready = false;
        return;
      }
      if (this.host.parentElement !== this.anchor) {
        this.mountInline();
      }
      this.ready = true;
      return;
    }

    if (this.dragging) return;

    const editorRect = this.getEditorRect();
    if (!editorRect) {
      this.host.style.visibility = "hidden";
      this.ready = false;
      return;
    }

    this.host.style.visibility = "visible";
    const widgetSize = this.getWidgetSize();
    const rel =
      this.userPositioned && this.dragPosition
        ? this.clampRelativePosition(
            this.dragPosition.relX,
            this.dragPosition.relY,
            editorRect,
            widgetSize
          )
        : this.defaultRelativePosition(editorRect, widgetSize);

    if (this.userPositioned) {
      this.dragPosition = rel;
    }

    this.applyPosition(editorRect, rel);
    this.ready = true;
  }

  private onDragStart(event: MouseEvent): void {
    if (!this.floating || event.button !== 0) return;

    const editorRect = this.getEditorRect();
    if (!editorRect) return;

    event.preventDefault();
    event.stopPropagation();

    const hostRect = this.host.getBoundingClientRect();
    this.dragging = true;
    this.container.classList.add("dragging");
    this.dragOrigin = {
      relX: hostRect.left - editorRect.left,
      relY: hostRect.top - editorRect.top,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };

    document.addEventListener("mousemove", this.boundDragMove);
    document.addEventListener("mouseup", this.boundDragEnd);
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.dragging || !this.positionRef) return;

    const editorRect = this.getEditorRect();
    if (!editorRect) return;

    const widgetSize = this.getWidgetSize();
    const rel = this.clampRelativePosition(
      this.dragOrigin.relX + (event.clientX - this.dragOrigin.pointerX),
      this.dragOrigin.relY + (event.clientY - this.dragOrigin.pointerY),
      editorRect,
      widgetSize
    );

    this.dragPosition = rel;
    this.userPositioned = true;
    this.applyPosition(editorRect, rel);
    this.ready = true;
    this.host.style.visibility = "visible";
  }

  private onDragEnd(): void {
    if (!this.dragging) return;

    this.dragging = false;
    this.container.classList.remove("dragging");
    document.removeEventListener("mousemove", this.boundDragMove);
    document.removeEventListener("mouseup", this.boundDragEnd);
    this.reposition();
  }

  update(state: EligibilityState, hasSig: boolean, sigVerified = false): void {
    this.applyStatus(state, hasSig, sigVerified);
    this.reposition();
  }

  private applyStatus(
    state: EligibilityState,
    hasSig: boolean,
    sigVerified: boolean
  ): void {
    if (hasSig && sigVerified) {
      this.statusEl.textContent = "✓ Signed";
      this.statusEl.className = "humanstamp-status eligible";
      this.actionBtn.hidden = true;
      this.actionBtn.disabled = false;
      return;
    }

    if (state.eligible) {
      this.statusEl.textContent = hasSig ? "✓ Signed" : "✓ Eligible";
      this.statusEl.className = "humanstamp-status eligible";
      this.actionBtn.hidden = hasSig;
      this.actionBtn.disabled = false;
    } else {
      this.statusEl.textContent = hasSig
        ? "○ Signature inactive"
        : "○ Not Yet Eligible";
      this.statusEl.className = "humanstamp-status ineligible";
      this.actionBtn.hidden = true;
    }
  }

  showLoading(): void {
    this.forceVisible();
    this.statusEl.textContent = "Signing…";
    this.statusEl.className = "humanstamp-status ineligible";
    this.actionBtn.hidden = false;
    this.actionBtn.disabled = true;
  }

  showError(message: string): void {
    this.forceVisible();
    this.statusEl.textContent = message;
    this.statusEl.className = "humanstamp-status error";
    this.actionBtn.hidden = false;
    this.actionBtn.disabled = false;
  }

  private forceVisible(): void {
    this.ready = true;
    this.host.style.visibility = "visible";
    this.host.style.pointerEvents = "auto";
    this.reposition();
  }

  destroy(): void {
    document.removeEventListener("mousemove", this.boundDragMove);
    document.removeEventListener("mouseup", this.boundDragEnd);
    if (this.floating) {
      window.removeEventListener("scroll", this.boundReposition, true);
      window.removeEventListener("resize", this.boundReposition);
    }
    this.host.remove();
  }
}

const WIDGET_STYLES = `
  :host {
    all: initial;
    display: block !important;
    pointer-events: auto !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .humanstamp-widget {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: #fafafa;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-size: 13px;
    color: #333;
    position: relative;
  }
  .humanstamp-widget.dragging {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: grabbing;
  }
  .humanstamp-drag-handle {
    all: unset;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 20px;
    color: #999;
    font-size: 14px;
    line-height: 1;
    cursor: grab;
    user-select: none;
    border-radius: 4px;
  }
  .humanstamp-drag-handle:hover {
    color: #666;
    background: rgba(0, 0, 0, 0.05);
  }
  .humanstamp-widget.dragging .humanstamp-drag-handle {
    cursor: grabbing;
  }
  .humanstamp-brand {
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .humanstamp-status {
    color: #666;
  }
  .humanstamp-status.eligible {
    color: #1a7f37;
    font-weight: 500;
  }
  .humanstamp-status.ineligible {
    color: #888;
  }
  .humanstamp-status.error {
    color: #b42318;
    font-weight: 500;
  }
  .humanstamp-action {
    margin-left: 4px;
    padding: 4px 10px;
    border: 1px solid #1a7f37;
    border-radius: 6px;
    background: #fff;
    color: #1a7f37;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .humanstamp-action:hover {
    background: #f0faf3;
  }
  .humanstamp-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
