import { CharacterOrigin } from "../shared/types";
import type { DraftIdentity } from "./draft-identity";
import { hashText } from "./draft-hash";
import { canUseExtensionStorage } from "../shared/extension-api";

const STORAGE_KEY = "draftProvenance";
const MAX_ENTRIES = 64;
const SAVE_DEBOUNCE_MS = 400;

export function draftStorageKey(identity: DraftIdentity): string {
  return [
    identity.adapterId,
    `c:${identity.composeId}`,
    `s:${hashText(identity.subject)}`,
    `r:${hashText(identity.recipients)}`,
  ].join(":");
}

interface ProvenanceRecord {
  origins: string;
  bodyHash: string;
  bodyLength: number;
  updatedAt: number;
}

type ProvenanceStore = Record<string, ProvenanceRecord>;

function encodeOrigins(origins: CharacterOrigin[]): string {
  return origins.map((origin) => (origin === "typed" ? "t" : "p")).join("");
}

function decodeOrigins(encoded: string): CharacterOrigin[] {
  return encoded.split("").map((char) => (char === "t" ? "typed" : "pasted"));
}

function reconcileOrigins(
  stored: CharacterOrigin[],
  bodyText: string,
  bodyHash: string,
  record: ProvenanceRecord
): CharacterOrigin[] | null {
  if (record.bodyHash === bodyHash && stored.length === bodyText.length) {
    return stored;
  }

  if (stored.length > bodyText.length) {
    return stored.slice(0, bodyText.length);
  }

  if (stored.length < bodyText.length) {
    const added = bodyText.length - stored.length;
    return [...stored, ...Array<CharacterOrigin>(added).fill("pasted")];
  }

  return null;
}

let pendingSave: {
  key: string;
  origins: CharacterOrigin[];
  bodyText: string;
  timer: number;
} | null = null;

async function readStore(): Promise<ProvenanceStore> {
  if (!canUseExtensionStorage()) return {};
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = result[STORAGE_KEY];
  return store && typeof store === "object" ? (store as ProvenanceStore) : {};
}

async function writeStore(store: ProvenanceStore): Promise<void> {
  if (!canUseExtensionStorage()) return;
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

function trimStore(store: ProvenanceStore): ProvenanceStore {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENTRIES) return store;

  entries.sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
  const trimmed = entries.slice(entries.length - MAX_ENTRIES);
  return Object.fromEntries(trimmed);
}

function tryLoadRecord(
  store: ProvenanceStore,
  key: string,
  bodyText: string
): CharacterOrigin[] | null {
  const record = store[key];
  if (!record || typeof record.origins !== "string") return null;

  const bodyHash = hashText(bodyText);
  const stored = decodeOrigins(record.origins);
  return reconcileOrigins(stored, bodyText, bodyHash, record);
}

export async function loadDraftProvenance(
  key: string,
  bodyText: string
): Promise<CharacterOrigin[] | null> {
  const store = await readStore();
  return tryLoadRecord(store, key, bodyText);
}

export async function loadDraftProvenanceWithFallback(
  identity: DraftIdentity
): Promise<CharacterOrigin[] | null> {
  const bodyText = identity.bodyText;
  if (!bodyText) return null;

  const store = await readStore();
  const keys = new Set<string>([
    draftStorageKey(identity),
    draftStorageKey({ ...identity, subject: "", recipients: "" }),
  ]);

  for (const key of keys) {
    const loaded = tryLoadRecord(store, key, bodyText);
    if (loaded) return loaded;
  }

  const prefix = `${identity.adapterId}:c:${identity.composeId}:`;
  let best: { updatedAt: number; origins: CharacterOrigin[] } | null = null;

  for (const [key, record] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    const loaded = tryLoadRecord(store, key, bodyText);
    if (!loaded) continue;
    if (!best || record.updatedAt > best.updatedAt) {
      best = { updatedAt: record.updatedAt, origins: loaded };
    }
  }

  return best?.origins ?? null;
}

export function saveDraftProvenance(
  key: string,
  origins: CharacterOrigin[],
  bodyText: string
): void {
  if (origins.length === 0 || origins.length !== bodyText.length) return;

  if (pendingSave?.timer) {
    window.clearTimeout(pendingSave.timer);
  }

  pendingSave = {
    key,
    origins: [...origins],
    bodyText,
    timer: window.setTimeout(() => {
      void flushDraftProvenance();
    }, SAVE_DEBOUNCE_MS),
  };
}

export async function saveDraftProvenanceNow(
  key: string,
  origins: CharacterOrigin[],
  bodyText: string
): Promise<void> {
  if (origins.length === 0 || origins.length !== bodyText.length) return;

  if (pendingSave?.timer) {
    window.clearTimeout(pendingSave.timer);
    pendingSave = null;
  }

  const store = await readStore();
  store[key] = {
    origins: encodeOrigins(origins),
    bodyHash: hashText(bodyText),
    bodyLength: bodyText.length,
    updatedAt: Date.now(),
  };

  await writeStore(trimStore(store));
}

export async function flushDraftProvenance(): Promise<void> {
  if (!pendingSave) return;

  const { key, origins, bodyText, timer } = pendingSave;
  pendingSave = null;
  window.clearTimeout(timer);

  const store = await readStore();
  store[key] = {
    origins: encodeOrigins(origins),
    bodyHash: hashText(bodyText),
    bodyLength: bodyText.length,
    updatedAt: Date.now(),
  };

  await writeStore(trimStore(store));
}
