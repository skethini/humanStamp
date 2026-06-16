import { ELIGIBILITY_THRESHOLD } from "../shared/constants";
import { EligibilityState } from "../shared/types";
import { ProvenanceTracker } from "./provenance";

export function computeEligibility(
  tracker: ProvenanceTracker,
  bodyText: string
): EligibilityState {
  const trimmed = bodyText.trim();
  const totalCharacters = trimmed.length;

  if (totalCharacters === 0) {
    return { eligible: false, humanRatio: 0, totalCharacters: 0 };
  }

  const humanRatio = tracker.getHumanRatio();
  return {
    eligible: humanRatio > ELIGIBILITY_THRESHOLD,
    humanRatio,
    totalCharacters,
  };
}
