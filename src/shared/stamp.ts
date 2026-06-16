export const STAMP_VERSION = "2" as const;

export interface VerificationPayload {
  contentHash: string;
  eligible: true;
  timestamp: string;
  version: typeof STAMP_VERSION;
}

export interface SignedStamp {
  payload: VerificationPayload;
  signature: string;
}
