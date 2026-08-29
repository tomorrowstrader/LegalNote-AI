import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ShareBrandBar, ShareBrandFooter } from "@/components/ShareBrandChrome";

interface PublicBookingSlot {
  id: string;
  startsAt: string;
  endsAt: string;
}

interface PublicBookingData {
  status: string;
  durationMinutes: number;
  expiresAt: string;
  respondedAt: string | null;
  updatedAt?: string | null;
  emailSentAt?: string | null;
  slotsUpdated?: boolean;
  selectedStartsAt: string | null;
  slots: PublicBookingSlot[];
  /** Firm name when configured — never a role label like “solicitor”. */
  organiserName: string | null;
  firmProfile: { firmName: string; logoUrl: string | null } | null;
}

function formatSlotLabel(startsAt: string, endsAt: string): { date: string; time: string } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return {
    date: format(start, "EEEE d MMMM yyyy"),
    time: `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`,
  };
}

export default function BookMeetingPage() {
  const { token } = useParams<{ token: string }>();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineNote, setDeclineNote] = useState("");
  const [bookedStartsAt, setBookedStartsAt] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotUnavailableNotice, setSlotUnavailableNotice] = useState<string | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useQuery<PublicBookingData>({
    queryKey: [`/api/book/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/book/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || "Invalid or expired booking link");
      }
      return body;
    },
    retry: false,
  });

  const bookMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest<{ status: string; startsAt: string; endsAt: string }>(
        "POST",
        `/api/book/${token}`,
        { slotId },
      );
    },
    onSuccess: (result) => {
      setBookedStartsAt(result.startsAt);
      setError(null);
      refetch();
    },
    onError: (err: Error) => {
      setError(err.message || "Could not book that time. Please try again.");
      if (err.message?.toLowerCase().includes("no longer available")) {
        setSelectedSlotId(null);
        setSlotUnavailableNotice("That time is no longer available. Please choose from the updated options below.");
        refetch();
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/book/${token}/decline`, {
        note: declineNote.trim() || undefined,
      });
    },
    onSuccess: () => {
      setDeclined(true);
      setError(null);
      refetch();
    },
    onError: (err: Error) => {
      setError(err.message || "Could not send your response. Please try again.");
    },
  });

  useEffect(() => {
    if (!data?.slots || !selectedSlotId) return;
    const stillAvailable = data.slots.some((slot) => slot.id === selectedSlotId);
    if (!stillAvailable) {
      setSelectedSlotId(null);
      setSlotUnavailableNotice(
        "That time is no longer available. Please choose from the updated options below.",
      );
    }
  }, [data?.slots, selectedSlotId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading proposed times…</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">Link invalid or expired</h1>
            <p className="text-sm text-muted-foreground">
              {(loadError as Error)?.message ||
                "This booking link is no longer valid. Please contact the person who sent it if you need a new one."}
            </p>
          </div>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  const organiserName =
    data.organiserName?.trim() || data.firmProfile?.firmName?.trim() || null;
  const alreadyBooked = data.status === "booked" || !!bookedStartsAt;
  const alreadyDeclined = data.status === "declined" || declined;
  const unavailable =
    data.status === "expired" ||
    data.status === "cancelled" ||
    (data.status !== "pending" && !alreadyBooked && !alreadyDeclined);

  if (alreadyBooked) {
    const when = bookedStartsAt || data.selectedStartsAt;
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold">Time confirmed</h1>
            <p className="text-sm text-muted-foreground">
              Thank you. Your meeting
              {organiserName ? (
                <>
                  {" "}
                  with <strong>{organiserName}</strong>
                </>
              ) : null}{" "}
              is booked
              {when ? (
                <>
                  {" "}
                  for{" "}
                  <strong>
                    {format(new Date(when), "EEEE d MMMM yyyy 'at' HH:mm")}
                  </strong>
                </>
              ) : null}
              .
            </p>
            <p className="text-xs text-muted-foreground">
              You should receive a calendar invitation and join link shortly.
            </p>
          </div>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  if (alreadyDeclined) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Response sent</h1>
            <p className="text-sm text-muted-foreground">
              Thank you.
              {organiserName ? (
                <>
                  {" "}
                  <strong>{organiserName}</strong> has been notified
                </>
              ) : (
                " They have been notified"
              )}{" "}
              that none of the proposed times work, and will be in touch with alternatives.
            </p>
          </div>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <ShareBrandBar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-card rounded-md border border-border shadow-md max-w-md w-full p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-semibold">Link no longer available</h1>
            <p className="text-sm text-muted-foreground">
              This booking request has {data.status === "expired" ? "expired" : "been closed"}.
              Please contact {organiserName || "the person who sent this link"} if you still need to
              arrange a meeting.
            </p>
          </div>
        </div>
        <ShareBrandFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <ShareBrandBar />
      <main className="flex-1 container max-w-lg mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Choose a meeting time</h1>
            <p className="text-sm text-muted-foreground">
              {organiserName ? (
                <>
                  <strong>{organiserName}</strong> has offered the following{" "}
                  {data.durationMinutes}-minute options.
                </>
              ) : (
                <>
                  The following {data.durationMinutes}-minute options have been offered for your
                  meeting.
                </>
              )}{" "}
              Select the time that suits you best.
            </p>
            {data.slotsUpdated && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Some times may have changed since the original email. The options below are current.
              </p>
            )}
          </div>

          <div className="space-y-2" role="listbox" aria-label="Proposed meeting times">
            {data.slots.map((slot) => {
              const label = formatSlotLabel(slot.startsAt, slot.endsAt);
              const selected = selectedSlotId === slot.id;
              return (
                <button
                  key={slot.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setSelectedSlotId(slot.id);
                    setShowDecline(false);
                    setError(null);
                    setSlotUnavailableNotice(null);
                  }}
                  className={`w-full text-left rounded-md border px-4 py-3 transition-colors ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/40"
                  }`}
                  data-testid={`button-book-slot-${slot.id}`}
                >
                  <div className="font-medium text-sm">{label.date}</div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    {label.time} (UK)
                  </div>
                </button>
              );
            })}
          </div>

          {slotUnavailableNotice && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2" role="status">
              {slotUnavailableNotice}
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <Button
              className="w-full"
              disabled={!selectedSlotId || bookMutation.isPending}
              onClick={() => selectedSlotId && bookMutation.mutate(selectedSlotId)}
              data-testid="button-confirm-booking"
            >
              {bookMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirming…
                </>
              ) : (
                "Confirm this time"
              )}
            </Button>

            {!showDecline ? (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setShowDecline(true);
                  setSelectedSlotId(null);
                  setError(null);
                }}
                data-testid="button-show-decline"
              >
                None of these times work
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border bg-card p-4">
                <Label htmlFor="decline-note">Share what works better (optional)</Label>
                <Textarea
                  id="decline-note"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. Afternoons next week are better"
                  data-testid="input-decline-note"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDecline(false)}
                    disabled={declineMutation.isPending}
                  >
                    Back
                  </Button>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                    data-testid="button-confirm-decline"
                  >
                    {declineMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send response"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Link expires {format(new Date(data.expiresAt), "d MMM yyyy")}. No matter details are
            shown on this page.
          </p>
        </div>
      </main>
      <ShareBrandFooter />
    </div>
  );
}
