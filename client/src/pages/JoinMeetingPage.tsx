import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Loader2, Video } from "lucide-react";
import { format } from "date-fns";
import { FirmPublicBrandBar, FirmPublicBrandFooter } from "@/components/FirmPublicBrandChrome";

const GUEST_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface PublicJoinData {
  state: "awaiting_email" | "ready" | "unavailable";
  unavailableReason?: "cancelled" | "ended" | "closed";
  startTime: string;
  endTime: string | null;
  organiserName: string | null;
  firmProfile: { firmName: string; logoUrl: string | null; phone?: string | null; email?: string | null } | null;
  meetingUrl?: string;
}

function formatWhen(startTime: string, endTime: string | null): string {
  const start = new Date(startTime);
  const startLabel = format(start, "EEEE d MMMM yyyy 'at' HH:mm");
  if (!endTime) return `${startLabel} (UK)`;
  return `${startLabel}–${format(new Date(endTime), "HH:mm")} (UK)`;
}

export default function JoinMeetingPage() {
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ meetingUrl: string; calendarSynced: boolean } | null>(null);

  const { data, isLoading, isError, error: loadError } = useQuery<PublicJoinData>({
    queryKey: [`/api/join/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/join/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "This meeting link was not found");
      }
      return body;
    },
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      return apiRequest<{ meetingUrl: string; calendarSynced: boolean }>(
        "POST",
        `/api/join/${token}`,
        { name: name.trim() || undefined, email: email.trim() },
      );
    },
    onSuccess: (result) => {
      setJoined(result);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || "Could not save your email. Please try again.");
    },
  });

  const firmProfile = data?.firmProfile ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <FirmPublicBrandBar firmProfile={null} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
        <FirmPublicBrandFooter firmProfile={null} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <FirmPublicBrandBar firmProfile={null} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Link not available</h1>
            <p className="text-sm text-muted-foreground">
              {(loadError as Error | null)?.message ||
                "This meeting link is no longer valid. Please contact the person who sent it if you need a new one."}
            </p>
          </div>
        </div>
        <FirmPublicBrandFooter firmProfile={null} />
      </div>
    );
  }

  const organiserName = data.organiserName?.trim() || data.firmProfile?.firmName?.trim() || null;
  const when = formatWhen(data.startTime, data.endTime);
  const readyUrl = joined?.meetingUrl || data.meetingUrl;
  const showJoin = Boolean(readyUrl) && (data.state === "ready" || !!joined);

  if (data.state === "unavailable") {
    const reason =
      data.unavailableReason === "cancelled"
        ? "This meeting was cancelled."
        : data.unavailableReason === "ended"
          ? "This meeting has ended."
          : "This meeting link is no longer available.";
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <FirmPublicBrandBar firmProfile={firmProfile} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Link no longer available</h1>
            <p className="text-sm text-muted-foreground">
              {reason} Please contact {organiserName || "the person who sent this link"} if you still
              need to meet.
            </p>
          </div>
        </div>
        <FirmPublicBrandFooter firmProfile={null} />
      </div>
    );
  }

  if (showJoin && readyUrl) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <FirmPublicBrandBar firmProfile={firmProfile} />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold">You're confirmed</h1>
            <p className="text-sm text-muted-foreground">
              {organiserName ? (
                <>
                  Your meeting with <strong>{organiserName}</strong> is{" "}
                </>
              ) : (
                "Your meeting is "
              )}
              <strong>{when}</strong>.
            </p>
            <Button asChild className="w-full" data-testid="button-join-meeting">
              <a href={readyUrl} target="_blank" rel="noopener noreferrer">
                <Video className="w-4 h-4 mr-2" />
                Join meeting
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              {joined
                ? joined.calendarSynced
                  ? "A calendar invitation is on its way to your email as well."
                  : "Your email is saved on the meeting. If a calendar invitation does not arrive, use the join button above."
                : "Use the button above to join."}
            </p>
          </div>
        </div>
        <FirmPublicBrandFooter firmProfile={null} />
      </div>
    );
  }

  const emailReady = GUEST_EMAIL_RE.test(email.trim().toLowerCase());

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <FirmPublicBrandBar firmProfile={firmProfile} />
      <main className="flex-1 container max-w-lg mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-2">
              <Video className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Join your meeting</h1>
            <p className="text-sm text-muted-foreground">
              {organiserName ? (
                <>
                  <strong>{organiserName}</strong> scheduled this call for <strong>{when}</strong>.
                </>
              ) : (
                <>
                  This call is scheduled for <strong>{when}</strong>.
                </>
              )}{" "}
              Add your email to join. It is saved on the meeting and added to the calendar invitation.
            </p>
          </div>

          <div className="space-y-3 rounded-md border bg-card p-4">
            <div className="space-y-1.5">
              <Label htmlFor="join-guest-name">Your name</Label>
              <Input
                id="join-guest-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                placeholder="Ada Lovelace"
                data-testid="input-join-guest-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="join-guest-email">
                Your email <span className="text-accent">*</span>
              </Label>
              <Input
                id="join-guest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                placeholder="ada@example.com"
                data-testid="input-join-guest-email"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            disabled={!emailReady || claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
            data-testid="button-confirm-join-email"
          >
            {claimMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Continue to meeting"
            )}
          </Button>
        </div>
      </main>
      <FirmPublicBrandFooter firmProfile={firmProfile} />
    </div>
  );
}
