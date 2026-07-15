import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell, X, Check, CheckCheck, FileText, Mic, AlertCircle,
  Calendar, Eye, Shield, ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  caseId?: string;
  caseTitle?: string;
  createdAt: string;
  readAt?: string;
}

const notificationIcon = (type: string) => {
  switch (type) {
    case 'transcription_complete': return Mic;
    case 'document_generated': return FileText;
    case 'client_viewed': return Eye;
    case 'consent_confirmed': return Shield;
    case 'pre_consent_acknowledged': return Shield;
    case 'pre_consent_declined': return Shield;
    case 'pre_consent_reschedule_requested': return Calendar;
    case 'audio_expiring': return AlertCircle;
    case 'deadline_approaching': return Calendar;
    case 'meeting_reminder': return Calendar;
    default: return Bell;
  }
};

const notificationColor = (type: string) => {
  switch (type) {
    case 'audio_expiring': return 'text-red-500';
    case 'deadline_approaching': return 'text-amber-500';
    case 'meeting_reminder': return 'text-amber-500';
    case 'consent_confirmed': return 'text-emerald-500';
    case 'pre_consent_acknowledged': return 'text-emerald-500';
    case 'pre_consent_declined': return 'text-red-500';
    case 'pre_consent_reschedule_requested': return 'text-amber-500';
    case 'transcription_complete': return 'text-blue-500';
    case 'document_generated': return 'text-blue-500';
    default: return 'text-muted-foreground';
  }
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // SSE for real-time notifications
  useEffect(() => {
    const evtSource = new EventSource('/api/notifications/stream', { withCredentials: true });
    evtSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    };
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        className="text-primary-foreground relative"
        onClick={() => setOpen(o => !o)}
        data-testid="button-notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" data-testid="badge-notification-count">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-50 rounded-md border border-border bg-popover shadow-lg"
          data-testid="panel-notifications">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{unreadCount} new</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 gap-1"
                  onClick={() => markAllReadMutation.mutate()}
                  data-testid="button-mark-all-read">
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7"
                onClick={() => setOpen(false)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Notifications list */}
          <ScrollArea className="max-h-[24rem] [&_[data-radix-scroll-area-scrollbar]]:opacity-100">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Updates on your cases will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(notification => {
                  const Icon = notificationIcon(notification.type);
                  const iconColor = notificationColor(notification.type);
                  const isUnread = !notification.readAt;

                  return (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-3 px-4 py-3 ${isUnread ? 'bg-accent/30' : ''} hover-elevate`}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-medium text-foreground leading-tight truncate flex-1 min-w-0">{notification.title}</p>
                          {isUnread && (
                            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 -mr-1 -mt-0.5"
                              onClick={() => markReadMutation.mutate(notification.id)}
                              title="Mark as read">
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground/70">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                          {notification.caseId && (
                            <Link href={`/case/${notification.caseId}`}>
                              <a className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                onClick={() => {
                                  setOpen(false);
                                  if (!notification.readAt) markReadMutation.mutate(notification.id);
                                }}>
                                <ExternalLink className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[120px] inline-block align-bottom">{notification.caseTitle || 'View case'}</span>
                              </a>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
