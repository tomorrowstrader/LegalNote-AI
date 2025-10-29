import { useState, useEffect } from "react";
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
}

export default function SyncCalendarModal({ 
  open, 
  onOpenChange, 
  caseId,
  caseTitle,
  deadline
}: SyncCalendarModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'outlook' | ''>('');
  const { toast } = useToast();

  const { data: connections, isLoading: providersLoading } = useQuery<{
    google: { connected: boolean; email?: string };
    outlook: { connected: boolean; email?: string };
  }>({
    queryKey: ['/api/oauth/connections'],
    enabled: open,
  });

  const syncMutation = useMutation({
    mutationFn: async (provider: 'google' | 'outlook') => {
      const res = await fetch(`/api/cases/${caseId}/sync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to sync calendar');
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
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync to calendar",
        variant: "destructive",
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
        <DialogContent data-testid="dialog-sync-calendar">
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
      <DialogContent data-testid="dialog-sync-calendar">
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
                <SelectItem value="outlook" disabled={providersLoading || !connections?.outlook.connected}>
                  Outlook {connections?.outlook.connected ? '✓' : '(Not connected)'}
                </SelectItem>
              </SelectContent>
            </Select>
            
            {connections && !connections.google.connected && !connections.outlook.connected && (
              <Alert>
                <AlertDescription>
                  No calendar connected. Please connect Google Calendar or Outlook in <a href="/settings" className="underline">Settings → Integrations</a> first.
                </AlertDescription>
              </Alert>
            )}
          </div>
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
