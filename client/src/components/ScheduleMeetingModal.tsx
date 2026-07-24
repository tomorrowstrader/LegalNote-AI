import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarPlus,
  Loader2,
  Search,
  Briefcase,
  X,
  Video,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Shield,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getApiErrorMessage, queryClient } from "@/lib/queryClient";
import { getSafeHttpsMeetingUrl } from "@/lib/meetingUrl";
import { format } from "date-fns";
import type { Case, Client, ScheduledMeeting } from "@shared/schema";

interface ScheduleMeetingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  googleConnected: boolean;
  outlookConnected: boolean;
  onNeedsCalendarConnection?: () => void;
}

function parseAttendeeEmails(raw: string): Array<{ email: string }> {
  const parts = raw
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const emails: Array<{ email: string }> = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const email = part.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    emails.push({ email });
  }
  return emails;
}

const DURATION_OPTIONS = [15, 20, 25, 30, 45, 60, 90, 120] as const;
const DEFAULT_DURATION_MINUTES = 30;

function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  if (minutes === 60) return "60 mins (1 hour)";
  if (minutes % 60 === 0) return `${minutes} mins (${minutes / 60} hours)`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${minutes} mins (${hours}h ${mins}m)`;
}

function addMinutesToTime(timeHHMM: string, minutes: number): string | null {
  if (!timeHHMM) return null;
  const [h, m] = timeHHMM.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function conferenceLabel(provider: "google" | "outlook"): string {
  return provider === "google" ? "Google Meet" : "Microsoft Teams";
}

export default function ScheduleMeetingModal({
  open,
  onOpenChange,
  googleConnected,
  outlookConnected,
  onNeedsCalendarConnection,
}: ScheduleMeetingModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION_MINUTES);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [showExistingLink, setShowExistingLink] = useState(false);
  const [attendeesRaw, setAttendeesRaw] = useState("");
  const [description, setDescription] = useState("");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [provider, setProvider] = useState<"google" | "outlook">("google");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  const { data: cases = [] } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
    enabled: open,
  });

  const { data: clientSearchResults = [] } = useQuery<Client[]>({
    queryKey: [`/api/clients/search?q=${encodeURIComponent(clientSearchQuery)}`],
    enabled: open && clientSearchQuery.trim().length >= 2 && !selectedClient,
  });

  const bothConnected = googleConnected && outlookConnected;
  const defaultProvider: "google" | "outlook" = googleConnected ? "google" : "outlook";
  const activeProvider = bothConnected ? provider : defaultProvider;
  const autoConferenceName = conferenceLabel(activeProvider);
  const computedEndTime = useMemo(
    () => addMinutesToTime(startTime, durationMinutes),
    [startTime, durationMinutes],
  );

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("");
    setDurationMinutes(DEFAULT_DURATION_MINUTES);
    setMeetingUrl("");
    setShowExistingLink(false);
    setAttendeesRaw("");
    setDescription("");
    setCaseId(null);
    setCaseSearch("");
    setProvider(defaultProvider);
    setSelectedClient(null);
    setClientName("");
    setClientSearchQuery("");
    setShowClientDropdown(false);
  }, [open, defaultProvider]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setClientName(client.name);
    setShowClientDropdown(false);
    setClientSearchQuery("");
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setClientName("");
    setClientSearchQuery("");
  };

  const handleClientInputChange = (value: string) => {
    setClientSearchQuery(value);
    setClientName(value);
    setSelectedClient(null);
    setShowClientDropdown(value.trim().length >= 2);
  };

  const createClientMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest<Client>("POST", "/api/clients", { name });
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      handleClientSelect(client);
      toast({
        title: "Client created",
        description: `${client.name} has been added to your client registry.`,
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create client",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const filteredCases = useMemo(() => {
    if (!caseSearch.trim()) return cases.slice(0, 8);
    const q = caseSearch.toLowerCase();
    return cases
      .filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          (c.matterReference && c.matterReference.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [cases, caseSearch]);

  const selectedCase = cases.find((c) => c.id === caseId);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !date || !startTime) {
        throw new Error("Title, date, and start time are required");
      }
      if (!selectedClient) {
        throw new Error("Select an existing client or create a new one");
      }

      const start = new Date(`${date}T${startTime}`);
      if (isNaN(start.getTime()) || start <= new Date()) {
        throw new Error("Start time must be in the future");
      }

      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const trimmedUrl = meetingUrl.trim();
      let safeUrl: string | undefined;
      if (trimmedUrl) {
        const normalized = getSafeHttpsMeetingUrl(trimmedUrl);
        if (!normalized) {
          throw new Error("Meeting URL must be a valid https link");
        }
        safeUrl = normalized;
      }

      const attendees = parseAttendeeEmails(attendeesRaw);
      if (attendeesRaw.trim() && attendees.length === 0) {
        throw new Error("Enter valid attendee email addresses");
      }

      return apiRequest<ScheduledMeeting>("POST", "/api/scheduled-meetings", {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        meetingUrl: safeUrl,
        createConference: !safeUrl,
        caseId: caseId || undefined,
        provider: activeProvider,
        attendees,
        clientEmail: attendees[0]?.email,
        clientName: selectedClient.name,
      });
    },
    onSuccess: (meeting) => {
      const platform =
        meeting.meetingPlatform === "meet"
          ? "Google Meet"
          : meeting.meetingPlatform === "teams"
            ? "Teams"
            : null;
      toast({
        title: "Meeting scheduled",
        description: platform
          ? `Added to your calendar with a ${platform} link.`
          : meeting.meetingUrl
            ? "Added to your calendar and Upcoming Meetings."
            : `Added to your calendar. ${autoConferenceName} link may appear after refresh if your account supports it.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-meetings"] });
      onOpenChange(false);
    },
    onError: (error: Error & { needsCalendarConnection?: boolean }) => {
      if (
        error.message?.includes("not connected") ||
        (error as { needsCalendarConnection?: boolean }).needsCalendarConnection
      ) {
        onOpenChange(false);
        onNeedsCalendarConnection?.();
        return;
      }
      toast({
        title: "Could not schedule meeting",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" data-testid="dialog-schedule-meeting">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Create the meeting here — we&apos;ll add it to your calendar and generate a{" "}
            {autoConferenceName} link automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
            <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              A <span className="font-medium text-foreground">{autoConferenceName}</span> join
              link will be created with the calendar event. No need to set one up first.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-title">Title</Label>
            <Input
              id="schedule-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Client conference"
              data-testid="input-schedule-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-client-name">
              Client Name <span className="text-accent">*</span>
            </Label>
            <div ref={clientSearchRef} className="relative">
              {selectedClient ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  <span
                    className="text-sm font-medium flex-1 truncate"
                    data-testid="text-schedule-selected-client"
                  >
                    {selectedClient.name}
                  </span>
                  {selectedClient.amlRiskLevel && (
                    <Badge
                      variant={
                        selectedClient.amlRiskLevel === "high"
                          ? "destructive"
                          : selectedClient.amlRiskLevel === "medium"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs shrink-0"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {selectedClient.amlRiskLevel.toUpperCase()}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleClearClient}
                    data-testid="button-schedule-clear-client"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Input
                  id="schedule-client-name"
                  placeholder="Search existing clients or type a new name..."
                  value={clientName}
                  onChange={(e) => handleClientInputChange(e.target.value)}
                  onFocus={() => {
                    if (clientSearchQuery.trim().length >= 2) setShowClientDropdown(true);
                  }}
                  data-testid="input-schedule-client-name"
                />
              )}
              {showClientDropdown && !selectedClient && (
                <div
                  className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto"
                  data-testid="dropdown-schedule-client-search"
                >
                  {clientSearchResults.length > 0 ? (
                    clientSearchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center justify-between gap-2"
                        onClick={() => handleClientSelect(c)}
                        data-testid={`option-schedule-client-${c.id}`}
                      >
                        <span className="truncate">{c.name}</span>
                        {c.amlRiskLevel && (
                          <Badge
                            variant={
                              c.amlRiskLevel === "high"
                                ? "destructive"
                                : c.amlRiskLevel === "medium"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="text-xs shrink-0"
                          >
                            {c.amlRiskLevel.toUpperCase()}
                          </Badge>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No matching clients
                    </div>
                  )}
                  {clientName.trim().length >= 2 && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2 border-t"
                      onClick={() => createClientMutation.mutate(clientName.trim())}
                      disabled={createClientMutation.isPending}
                      data-testid="button-schedule-create-client-inline"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {createClientMutation.isPending
                          ? "Creating..."
                          : `Create "${clientName.trim()}" as new client`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={date}
                min={format(new Date(), "yyyy-MM-dd")}
                onChange={(e) => setDate(e.target.value)}
                data-testid="input-schedule-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-start">Start</Label>
              <Input
                id="schedule-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="input-schedule-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-duration">Duration</Label>
              <Select
                value={String(durationMinutes)}
                onValueChange={(v) => setDurationMinutes(Number(v))}
              >
                <SelectTrigger id="schedule-duration" data-testid="select-schedule-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((mins) => (
                    <SelectItem key={mins} value={String(mins)}>
                      {formatDurationLabel(mins)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {startTime && computedEndTime && (
              <p className="col-span-2 text-xs text-muted-foreground" data-testid="text-schedule-end-preview">
                Ends at {computedEndTime}
                {(() => {
                  const [h, m] = startTime.split(":").map(Number);
                  const crossesMidnight = h * 60 + m + durationMinutes >= 24 * 60;
                  return crossesMidnight ? " (next day)" : "";
                })()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-attendees">Attendees (optional)</Label>
            <Input
              id="schedule-attendees"
              value={attendeesRaw}
              onChange={(e) => setAttendeesRaw(e.target.value)}
              placeholder="client@example.com, counsel@firm.com"
              data-testid="input-schedule-attendees"
            />
            <p className="text-xs text-muted-foreground">Separate emails with commas</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-description">Notes (optional)</Label>
            <Textarea
              id="schedule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Agenda or context for the calendar event"
              data-testid="input-schedule-description"
            />
          </div>

          {bothConnected && (
            <div className="space-y-2">
              <Label>Calendar</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as "google" | "outlook")}
              >
                <SelectTrigger data-testid="select-schedule-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google">Google Calendar (Meet link)</SelectItem>
                  <SelectItem value="outlook">Outlook Calendar (Teams link)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              Link case (optional)
            </Label>
            {selectedCase ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedCase.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedCase.clientName}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCaseId(null)}
                  data-testid="button-clear-schedule-case"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cases…"
                    value={caseSearch}
                    onChange={(e) => setCaseSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-schedule-case-search"
                  />
                </div>
                {caseSearch.trim() && (
                  <div className="max-h-36 overflow-y-auto space-y-1 rounded-md border p-1">
                    {filteredCases.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No cases found</p>
                    ) : (
                      filteredCases.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-2 py-1.5 rounded-sm text-sm hover:bg-muted"
                          onClick={() => {
                            setCaseId(c.id);
                            setCaseSearch("");
                            if (c.clientId && c.clientName && !selectedClient) {
                              setSelectedClient({
                                id: c.clientId,
                                name: c.clientName,
                                amlRiskLevel: null,
                              } as Client);
                              setClientName(c.clientName);
                              setClientSearchQuery("");
                              setShowClientDropdown(false);
                            }
                          }}
                          data-testid={`button-schedule-select-case-${c.id}`}
                        >
                          <span className="font-medium">{c.title}</span>
                          <span className="text-muted-foreground"> · {c.clientName}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowExistingLink((v) => !v)}
              data-testid="button-toggle-existing-link"
            >
              <span>Use an existing meeting link instead</span>
              {showExistingLink ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showExistingLink && (
              <div className="space-y-2">
                <Label htmlFor="schedule-url">Meeting URL</Label>
                <Input
                  id="schedule-url"
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://zoom.us/j/… or https://meet.google.com/…"
                  data-testid="input-schedule-url"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a Zoom/Meet/Teams link to skip auto-creating {autoConferenceName}.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-schedule-dismiss"
          >
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              createMutation.isPending ||
              !title.trim() ||
              !date ||
              !startTime ||
              !selectedClient
            }
            data-testid="button-confirm-schedule"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <CalendarPlus className="w-4 h-4 mr-1" />
            )}
            Schedule with {autoConferenceName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
