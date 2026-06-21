import { SignedStamp } from "./stamp";

export const SIGN_STAMP_MESSAGE = "humanstamp:sign" as const;

export interface SignStampRequest {
  type: typeof SIGN_STAMP_MESSAGE;
  contentHash: string;
}

export type SignStampResponse =
  | { ok: true; stamp: SignedStamp }
  | { ok: false; error: string };
