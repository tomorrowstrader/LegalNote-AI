import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Parse `apiRequest` / query errors (`403: {"message":"..."}`) into a short user-facing string. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (!raw) return fallback;

  const withoutStatus = raw.replace(/^\d{3}:\s*/, "").trim();
  let message = withoutStatus;
  let code: string | undefined;

  try {
    const parsed = JSON.parse(withoutStatus);
    if (typeof parsed?.message === "string" && parsed.message.trim()) {
      message = parsed.message.trim();
    }
    if (typeof parsed?.code === "string") code = parsed.code;
  } catch {
    // Not JSON — use stripped status text as-is
  }

  if (code === "EVALUATION_EXPIRED") {
    return message || "Your governed evaluation period has ended. Subscribe at /subscribe to continue.";
  }
  if (code === "NOT_ALLOWLISTED") {
    return "Your account does not have access to this action. Please contact support if you need access.";
  }
  if (code === "litigation_hold") {
    return "This matter is under litigation hold, so a new version cannot be produced.";
  }
  if (code === "already_processing") {
    return "This matter is already being processed. Please wait for it to finish.";
  }
  if (code === "inactive_parent") {
    return "Only the current version can be used to produce a new version.";
  }
  if (code === "transcript_required") {
    return "No transcript is available to produce a new attendance note.";
  }
  if (code === "unsupported_type") {
    return "Further versions can only be produced for attendance notes and client letters.";
  }
  if (code === "SCHEMA_MIGRATION_REQUIRED") {
    return message || "Database schema needs an update. Please contact support or run pending migrations.";
  }

  message = message.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  if (
    !message ||
    /doctype|<!html/i.test(message) ||
    /bad gateway|cloudflare|error code 502|error code 504/i.test(message)
  ) {
    if (/502|504|bad gateway|cloudflare/i.test(raw)) {
      return "The server took too long to respond. Please try again in a moment.";
    }
    return fallback;
  }
  // Prefer a usable slice over a generic fallback for long provider errors
  if (message.length > 280) {
    return `${message.slice(0, 277).trimEnd()}…`;
  }
  return message;
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      // Drop stale auth cache so the SPA leaves the "logged-in zombie" state
      // (cached user + frozen processing UI after session expiry).
      if (queryKey[0] !== "/api/auth/user") {
        void queryClient.setQueryData(["/api/auth/user"], null);
        void queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
