import type { MatterKind } from "./matterKinds";
import { normalizeMatterKind } from "./matterKinds";

export const CLIENT_FACING_RECORDING_TYPES = [
  "full_meeting",
  "telephone_call",
  "file_note",
  "court_hearing",
  "police_station",
] as const;

export const INTERNAL_RECORDING_TYPES = ["internal_meeting", "file_note"] as const;

export const ALL_RECORDING_TYPES = [
  ...CLIENT_FACING_RECORDING_TYPES,
  "internal_meeting",
] as const;

export type ClientFacingRecordingType = (typeof CLIENT_FACING_RECORDING_TYPES)[number];
export type InternalRecordingType = (typeof INTERNAL_RECORDING_TYPES)[number];
export type PermittedRecordingType = (typeof ALL_RECORDING_TYPES)[number];

export const CLIENT_FACING_RECORDING_TYPE_SET = new Set<string>(CLIENT_FACING_RECORDING_TYPES);
export const ALL_RECORDING_TYPE_SET = new Set<string>(ALL_RECORDING_TYPES);

export function isClientFacingRecordingType(value: unknown): value is ClientFacingRecordingType {
  return typeof value === "string" && CLIENT_FACING_RECORDING_TYPE_SET.has(value);
}

export function isPermittedRecordingType(value: unknown): value is PermittedRecordingType {
  return typeof value === "string" && ALL_RECORDING_TYPE_SET.has(value);
}

export function isInternalRecordingType(value: unknown): boolean {
  return value === "internal_meeting";
}

export function recordingTypesForMatterKind(kind: string | null | undefined): readonly string[] {
  const normalized = normalizeMatterKind(kind);
  if (normalized === "client") {
    return CLIENT_FACING_RECORDING_TYPES;
  }
  return INTERNAL_RECORDING_TYPES;
}

export function defaultRecordingTypeForMatterKind(kind: string | null | undefined): PermittedRecordingType {
  return normalizeMatterKind(kind) === "client" ? "full_meeting" : "internal_meeting";
}

export function shouldGenerateClientLetter(params: {
  matterKind?: string | null;
  recordingType?: string | null;
  explicit?: boolean;
}): boolean {
  if (params.explicit === false) return false;
  if (!isClientMatterKindSafe(params.matterKind)) return false;
  if (isInternalRecordingType(params.recordingType)) return false;
  return true;
}

function isClientMatterKindSafe(kind: string | null | undefined): boolean {
  return normalizeMatterKind(kind) === "client";
}

export function validateRecordingType(
  value: unknown,
  options?: { matterKind?: MatterKind | string | null },
):
  | { ok: true; recordingType: PermittedRecordingType }
  | { ok: false; message: string } {
  if (!isPermittedRecordingType(value)) {
    return {
      ok: false,
      message: `Invalid recording type. Permitted types: ${ALL_RECORDING_TYPES.join(", ")}`,
    };
  }

  if (options?.matterKind !== undefined) {
    const allowed = recordingTypesForMatterKind(options.matterKind);
    if (!allowed.includes(value)) {
      return {
        ok: false,
        message: `Recording type "${value}" is not permitted for this matter kind. Permitted types: ${allowed.join(", ")}`,
      };
    }
  }

  return { ok: true, recordingType: value };
}
