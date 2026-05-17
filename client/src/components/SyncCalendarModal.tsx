import { useState, useEffect, useRef } from "react";
import { Calendar as CalendarIcon, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface SyncCalendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseTitle: string;
  deadline: string | null;
  priority: string;
  notes: string;
  isAllDay: boolean;
}

export default function SyncCalendarModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  deadline,
  priority,
  notes,
  isAllDay
}: SyncCalendarModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'outlook' | ''>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const { toast } = useToast();

  const { data: connections, isLoading: providersLoading, refetch: refetchConnections } = useQuery<{
    google: { connected: boolean; email?: string };
    outlook: { connected: boolean; email?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
    enabled: open,
  });

  // Listen for OAuth popup callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: verify origin
      if (event.origin !== window.location.origin) {
        return;
      }

      // Check if message is from OAuth callback
      if (event.data?.source === 'calendar-oauth-callback' && event.data?.success) {
        const { provider, syncSuccess, syncError, caseId: messageCaseId } = event.data;
        
        // Defensive: verify the popup's caseId matches the currently open case (prevent cross-case races)
        if (messageCaseId && messageCaseId !== caseId) {
          console.warn('OAuth callback caseId mismatch - ignoring message');
          return;
        }
        
        setIsConnecting(false);
        
        // Close popup if still open
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }

        // Refetch connections to update UI
        refetchConnections();

        // Check if auto-sync was successful
        if (syncSuccess) {
          // Auto-sync succeeded!
          queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
          queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
          
          toast({
            title: "Calendar Synced!",
            description: `Connected ${provider === 'google' ? 'Google Calendar' : 'Outlook'} and synced deadline automatically.`,
            duration: 6000,
          });
          
          // Close modal
          onOpenChange(false);
        } else if (syncError) {
          // Auto-sync failed, but connection succeeded
          const errorMessages: Record<string, string> = {
            case_not_found: "Case not found.",
            event_creation_failed: "Calendar event creation failed.",
            unknown: "Auto-sync failed.",
          };
          
          toast({
            title: "Calendar Connected",
            description: `${errorMessages[syncError] || "Auto-sync failed."} You can try syncing manually.`,
            duration: 8000,
          });
          
          // Set the provider so user can retry manually
          setSelectedProvider(provider);
        } else {
          // Just connected, no sync attempt (shouldn't happen with our new flow)
          toast({
            title: "Calendar Connected",
            description: `Successfully connected ${provider === 'google' ? 'Google Calendar' : 'Outlook'}`,
            duration: 3000,
          });
          
          setSelectedProvider(provider);
        }
      } else if (event.data?.source === 'calendar-oauth-callback' && event.data?.error) {
        setIsConnecting(false);
        
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }

        toast({
          title: "Connection Failed",
          description: event.data.error || "Failed to connect calendar",
          variant: "destructive",
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [caseId, onOpenChange, refetchConnections, toast]);

  const syncMutation = useMutation({
    mutationFn: async (provider: 'google' | 'outlook') => {
      const res = await fetch(`/api/cases/${caseId}/sync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, notes, priority, isAllDay }),
      });
      if (!res.ok) {
        const error = await res.json();
        // Add requiresReconnect flag to error for handling
        const err = new Error(error.message || 'Failed to sync calendar') as any;
        err.requiresReconnect = error.requiresReconnect;
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      
      toast({
        title: "Calendar Synced",
        description: `Case deadline synced to ${data.provider === 'google' ? 'Google Calendar' : 'Outlook'}`,
        duration: 6000,
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      // If token expired, refresh connections list to show reconnect buttons
      if (error.requiresReconnect) {
        refetchConnections();
        setSelectedProvider('');
      }
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync to calendar",
        variant: "destructive",
        duration: 8000,
      });
    }
  });

  const unsyncMutation = useMutation({
    mutationFn: async (provider?: 'google' | 'outlook') => {
      const res = await fetch(`/api/cases/${caseId}/unsync-calendar`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to unsync calendar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId] });
      
      toast({
        title: "Calendar Unsynced",
        description: "Calendar event removed successfully",
        duration: 6000,
      });
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove calendar event",
        variant: "destructive",
      });
    }
  });

  // Detect if user is on mobile device
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const handleConnectCalendar = async (provider: 'google' | 'outlook') => {
    setIsConnecting(true);

    // MOBILE: Use full-page redirect (no popup blockers!)
    if (isMobile()) {
      try {
        // POST with sync context - backend will handle auto-sync after OAuth
        const response = await fetch(`/api/calendar/auth/${provider}`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId, deadline, notes, priority, isAllDay }),
        });

        if (!response.ok) {
          throw new Error('Failed to get authorization URL');
        }

        const { authUrl } = await response.json();

        // Full-page redirect (works on all mobile browsers!)
        window.location.href = authUrl;
      } catch (error) {
        setIsConnecting(false);
        toast({
          title: "Connection Error",
          description: "Failed to initiate calendar connection",
          variant: "destructive",
        });
      }

      return;
    }

    // DESKTOP: Use popup window (better UX, no page reload)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      '',  // Start with blank page
      `${provider}-oauth`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (!popup) {
      setIsConnecting(false);
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for this site to connect your calendar",
        variant: "destructive",
      });
      return;
    }

    popupRef.current = popup;

    try {
      // POST with sync context - backend will handle auto-sync after OAuth
      const response = await fetch(`/api/calendar/auth/${provider}?popup=true`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, deadline, notes, priority, isAllDay }),
      });

      if (!response.ok) {
        throw new Error('Failed to get authorization URL');
      }

      const { authUrl } = await response.json();

      // Navigate the already-open popup to the OAuth URL
      popup.location.href = authUrl;

      // Check if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
        }
      }, 500);
    } catch (error) {
      // Close the popup on error
      if (popup && !popup.closed) {
        popup.close();
      }
      
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: "Failed to initiate calendar connection",
        variant: "destructive",
      });
    }
  };

  const handleSync = () => {
    if (!selectedProvider) {
      toast({
        title: "Select Provider",
        description: "Please select a calendar provider",
        variant: "destructive",
      });
      return;
    }

    syncMutation.mutate(selectedProvider);
  };

  if (!deadline) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="dialog-sync-calendar" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Sync to Calendar</DialogTitle>
            <DialogDescription>
              Sync case deadline to Google Calendar or Outlook
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertDescription>
              This case doesn't have a deadline set. Please set a deadline first using "Set Priority & Deadline" action.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-sync">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-sync-calendar" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Sync to Calendar</DialogTitle>
          <DialogDescription>
            Sync deadline for "{caseTitle}" to your calendar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <CalendarIcon className="h-4 w-4" />
            <AlertDescription>
              Deadline: {format(new Date(deadline), 'PPP')}
            </AlertDescription>
          </Alert>

          {connections && !connections.google.connected && !connections.outlook.connected ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Connect your calendar to sync this deadline and get reminders
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => handleConnectCalendar('google')}
                  disabled={isConnecting}
                  data-testid="button-connect-google"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Google Calendar"}
                </Button>
                
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={() => handleConnectCalendar('outlook')}
                  disabled={isConnecting}
                  data-testid="button-connect-outlook"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Outlook Calendar"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="provider">Calendar Provider</Label>
              <Select value={selectedProvider} onValueChange={(value) => setSelectedProvider(value as 'google' | 'outlook')}>
                <SelectTrigger id="provider" data-testid="select-calendar-provider">
                  <SelectValue placeholder="Select calendar provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google" disabled={providersLoading || !connections?.google.connected}>
                    Google Calendar {connections?.google.connected ? '✓' : '(Not connected)'}
                  </SelectItem>
                  <SelectItem value="outlook" disabled={providersLoading || !connections?.outlook?.connected}>
                    Outlook Calendar {connections?.outlook?.connected ? '✓' : '(Not connected)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-sync"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={!selectedProvider || syncMutation.isPending}
            data-testid="button-confirm-sync"
          >
            <Check className="w-4 h-4 mr-2" />
            {syncMutation.isPending ? "Syncing..." : "Sync to Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
