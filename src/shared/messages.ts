import { SignedStamp } from "./stamp";

export const SIGN_STAMP_MESSAGE = "humanstamp:sign" as const;
export const SET_DISPLAY_NAME_MESSAGE = "humanstamp:set-display-name" as const;
export const GET_DISPLAY_NAME_MESSAGE = "humanstamp:get-display-name" as const;

export interface SignStampRequest {
  type: typeof SIGN_STAMP_MESSAGE;
  contentHash: string;
}

export interface SetDisplayNameRequest {
  type: typeof SET_DISPLAY_NAME_MESSAGE;
  displayName: string;
}

export interface GetDisplayNameRequest {
  type: typeof GET_DISPLAY_NAME_MESSAGE;
}

export type SignStampResponse =
  | { ok: true; stamp: SignedStamp }
  | { ok: false; error: string };

export type SetDisplayNameResponse = { ok: true } | { ok: false; error: string };

export type GetDisplayNameResponse =
  | { ok: true; displayName: string }
  | { ok: false; error: string };
