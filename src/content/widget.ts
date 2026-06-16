import { EligibilityState } from "../shared/types";

export class HumanStampWidget {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private statusEl: HTMLElement;
  private actionBtn: HTMLButtonElement;
  private onAddSignature: () => void;

  constructor(anchor: HTMLElement, onAddSignature: () => void) {
    this.onAddSignature = onAddSignature;
    this.host = document.createElement("div");
    this.host.className = "humanstamp-widget-host";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = WIDGET_STYLES;
    this.shadow.appendChild(style);

    const container = document.createElement("div");
    container.className = "humanstamp-widget";
    container.innerHTML = `
      <div class="humanstamp-brand">HumanStamp</div>
      <div class="humanstamp-status" data-status>○ Not Yet Eligible</div>
      <button class="humanstamp-action" type="button" hidden>Add Signature</button>
    `;

    this.shadow.appendChild(container);
    this.statusEl = container.querySelector("[data-status]")!;
    this.actionBtn = container.querySelector(".humanstamp-action")!;
    this.actionBtn.addEventListener("click", () => this.onAddSignature());

    const parent = anchor.parentElement ?? document.body;
    parent.insertBefore(this.host, anchor.nextSibling);
  }

  update(state: EligibilityState, hasSig: boolean): void {
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

  destroy(): void {
    this.host.remove();
  }
}

const WIDGET_STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .humanstamp-widget {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0;
    padding: 8px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: #fafafa;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-size: 13px;
    color: #333;
    z-index: 2147483646;
    position: relative;
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
