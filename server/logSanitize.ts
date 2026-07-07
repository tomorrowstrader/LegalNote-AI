/**
 * Global console sanitisation — patches console.log/error/warn/info on import.
 * Side-effect module; must be imported before any other server code that logs.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const SAFE_KEYS = new Set([
  "caseId",
  "userId",
  "sessionId",
  "documentId",
  "importId",
  "botId",
  "provider",
  "status",
  "code",
  "statusCode",
  "count",
  "counts",
  "bytes",
  "size",
  "length",
  "contentLength",
  "cost",
  "costs",
  "timestamp",
  "createdAt",
  "updatedAt",
  "duration",
  "method",
  "path",
  "name",
  "requestId",
  "recordingType",
  "noteMode",
  "practiceArea",
  "chunkIndex",
  "chunkNumber",
]);

const BLOCKED_KEYS = new Set([
  "email",
  "to",
  "from",
  "phone",
  "phoneNumber",
  "recipientEmail",
  "recipientName",
  "clientName",
  "clientEmail",
  "title",
  "notes",
  "body",
  "content",
  "transcript",
  "message",
  "errors",
  "stack",
  "response",
  "config",
  "request",
  "errorText",
  "litigationHoldReason",
  "matterReference",
  "rawResponseBody",
  "details",
]);

const EMAIL_PATTERN =
  /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;
const E164_PATTERN = /\+[0-9]{10,15}\b/g;
const BARE_PHONE_PATTERN =
  /(?<![0-9a-fA-F-])(?<=(?:^|[\s(,]))[0-9]{10,15}(?![0-9a-fA-F-])(?=$|[\s),.])/g;
const LOG_PREFIX_PATTERN = /^\[[A-Za-z0-9_\- ]+\]/;

function looksLikeJsonApiBody(s: string): boolean {
  const trimmed = s.trim();

  if (trimmed.length <= 40) {
    return false;
  }

  if (LOG_PREFIX_PATTERN.test(trimmed)) {
    return false;
  }

  if (trimmed.startsWith("{")) {
    return true;
  }

  if (trimmed.startsWith("[")) {
    let i = 1;
    while (i < trimmed.length && /\s/.test(trimmed[i]!)) {
      i++;
    }
    if (i < trimmed.length) {
      const c = trimmed[i]!;
      if (c === "{" || c === '"' || c === "[" || (c >= "0" && c <= "9") || c === "-") {
        return true;
      }
      if (
        trimmed.startsWith("true", i) ||
        trimmed.startsWith("false", i) ||
        trimmed.startsWith("null", i)
      ) {
        return true;
      }
    }
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  }

  return false;
}

function redactPiiFromMessage(s: string): string {
  let result = s.replace(EMAIL_PATTERN, "[REDACTED_EMAIL]");
  result = result.replace(E164_PATTERN, "[REDACTED_PHONE]");
  result = result.replace(BARE_PHONE_PATTERN, "[REDACTED_PHONE]");

  if (IS_PRODUCTION && result.length > 500) {
    result = `${result.slice(0, 500)}…[TRUNCATED]`;
  }

  return result;
}

function sanitizeString(s: string): string {
  if (looksLikeJsonApiBody(s)) {
    return "[REDACTED_API_BODY]";
  }
  return redactPiiFromMessage(s);
}

function extractGraphRequestId(error: Error & Record<string, unknown>): string | undefined {
  const body = error.body;
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const graphError = (body as Record<string, unknown>).error;
  if (!graphError || typeof graphError !== "object") {
    return undefined;
  }

  const innerError = (graphError as Record<string, unknown>).innerError;
  if (!innerError || typeof innerError !== "object") {
    return undefined;
  }

  const requestId =
    (innerError as Record<string, unknown>)["request-id"] ??
    (innerError as Record<string, unknown>)["client-request-id"];

  return typeof requestId === "string" ? requestId : undefined;
}

function sanitizeError(e: Error): Record<string, unknown> {
  const err = e as Error & Record<string, unknown>;
  const result: Record<string, unknown> = {
    name: e.name || e.constructor?.name || "Error",
    message: sanitizeString(e.message),
  };

  if ("code" in err && err.code !== undefined) {
    result.code = err.code;
  }
  if ("status" in err && err.status !== undefined) {
    result.status = err.status;
  }
  if ("statusCode" in err && err.statusCode !== undefined) {
    result.statusCode = err.statusCode;
  }

  const requestId = extractGraphRequestId(err);
  if (requestId) {
    result.requestId = requestId;
  }

  return result;
}

function isTypedArray(arg: unknown): arg is ArrayBufferView {
  return ArrayBuffer.isView(arg) && !(arg instanceof DataView);
}

function sanitizeLogArg(arg: unknown, depth: number, visited?: WeakSet<object>): unknown {
  if (depth > 4) {
    return "[MAX_DEPTH]";
  }

  if (arg instanceof Error) {
    return sanitizeError(arg);
  }
  if (typeof arg === "string") {
    return sanitizeString(arg);
  }
  if (Buffer.isBuffer(arg)) {
    return `[Buffer ${arg.length} bytes]`;
  }
  if (isTypedArray(arg)) {
    return `[Buffer ${arg.byteLength} bytes]`;
  }
  if (arg === null || typeof arg !== "object") {
    return arg;
  }

  const seen = visited ?? new WeakSet<object>();
  if (seen.has(arg)) {
    return "[CIRCULAR]";
  }
  seen.add(arg);

  if (Array.isArray(arg)) {
    return arg.map((item) => sanitizeLogArg(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(arg)) {
    if (SAFE_KEYS.has(key)) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        result[key] = value;
      } else if (typeof value === "object") {
        result[key] = sanitizeLogArg(value, depth + 1, seen);
      } else {
        result[key] = value;
      }
    } else if (BLOCKED_KEYS.has(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 40) {
      result[key] = sanitizeString(value);
    } else if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    } else if (typeof value === "object") {
      result[key] = sanitizeLogArg(value, depth + 1, seen);
    } else {
      result[key] = value;
    }
  }

  return result;
}

const original = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

let sanitizing = false;

function wrap(fn: typeof console.log) {
  return (...args: unknown[]) => {
    if (sanitizing) {
      return fn.apply(console, args);
    }

    sanitizing = true;
    try {
      const safe = args.map((a) => sanitizeLogArg(a, 0));
      fn.apply(console, safe);
    } catch {
      fn.apply(console, ["[LOG_SANITISATION_FAILED]"]);
    } finally {
      sanitizing = false;
    }
  };
}

const disabled =
  process.env.LOG_SANITIZE === "false" && !process.env.RAILWAY_ENVIRONMENT;

if (!disabled) {
  console.log = wrap(original.log);
  console.error = wrap(original.error);
  console.warn = wrap(original.warn);
  console.info = wrap(original.info);
}
