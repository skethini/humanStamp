import { CharacterOrigin } from "../shared/types";

/**
 * Tracks whether each character in the document was typed or pasted.
 * Provenance follows the final document — edits update classification in place.
 */
export class ProvenanceTracker {
  private origins: CharacterOrigin[] = [];

  get length(): number {
    return this.origins.length;
  }

  getHumanRatio(): number {
    if (this.origins.length === 0) return 0;
    const typed = this.origins.filter((o) => o === "typed").length;
    return typed / this.origins.length;
  }

  syncFromText(text: string, defaultOrigin: CharacterOrigin = "pasted"): void {
    if (text.length === this.origins.length) return;

    if (text.length < this.origins.length) {
      this.origins = this.origins.slice(0, text.length);
      return;
    }

    const added = text.length - this.origins.length;
    this.origins.push(...Array(added).fill(defaultOrigin));
  }

  applyBeforeInput(
    inputType: string,
    data: string | null,
    start: number,
    end: number
  ): void {
    const deleteCount = end - start;

    if (deleteCount > 0) {
      this.origins.splice(start, deleteCount);
    }

    if (!data) return;

    const origin = this.originForInputType(inputType);
    const insertAt = start;
    const newOrigins = Array(data.length).fill(origin) as CharacterOrigin[];
    this.origins.splice(insertAt, 0, ...newOrigins);
  }

  private originForInputType(inputType: string): CharacterOrigin {
    if (
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop" ||
      inputType === "insertFromYank" ||
      inputType.includes("Paste")
    ) {
      return "pasted";
    }
    return "typed";
  }

  reset(): void {
    this.origins = [];
  }

  getOrigins(): CharacterOrigin[] {
    return [...this.origins];
  }

  setOrigins(origins: CharacterOrigin[]): void {
    this.origins = [...origins];
  }
}
