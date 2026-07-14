export const CLIENT_FACING_RECORDING_TYPES = [
  "full_meeting",
  "telephone_call",
  "file_note",
  "court_hearing",
  "police_station",
] as const;

export type ClientFacingRecordingType = (typeof CLIENT_FACING_RECORDING_TYPES)[number];

export const CLIENT_FACING_RECORDING_TYPE_SET = new Set<string>(CLIENT_FACING_RECORDING_TYPES);

export function isClientFacingRecordingType(value: unknown): value is ClientFacingRecordingType {
  return typeof value === "string" && CLIENT_FACING_RECORDING_TYPE_SET.has(value);
}

export function validateRecordingType(value: unknown):
  | { ok: true; recordingType: ClientFacingRecordingType }
  | { ok: false; message: string } {
  if (isClientFacingRecordingType(value)) {
    return { ok: true, recordingType: value };
  }

  return {
    ok: false,
    message: `Invalid recording type. Permitted types: ${CLIENT_FACING_RECORDING_TYPES.join(", ")}`,
  };
}
