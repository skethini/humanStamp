export type CharacterOrigin = "typed" | "pasted";

export interface EligibilityState {
  eligible: boolean;
  humanRatio: number;
  totalCharacters: number;
}

export interface UserSettings {
  displayName: string;
}

export interface EditorAdapter {
  readonly id: string;
  readonly usesFloatingWidget: boolean;
  /** Outlook often skips beforeinput; sync provenance from input as a fallback. */
  readonly needsInputProvenanceFallback: boolean;
  matches(): boolean;
  findEditor(): HTMLElement | null;
  getText(editor: HTMLElement): string;
  setText(editor: HTMLElement, text: string): void;
  getSelectionOffsets(editor: HTMLElement): { start: number; end: number };
  getWidgetAnchor(editor: HTMLElement): HTMLElement;
}
