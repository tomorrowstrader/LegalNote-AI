import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, X, Check, CheckCheck, FileText, Mic, AlertCircle,
  Calendar, Shield, ExternalLink, RefreshCw, Mail, Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { OPEN_NOTIFICATIONS_EVENT } from "@/lib/mobileChromeEvents";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  caseId?: string;
  caseTitle?: string;
  documentId?: string;
  documentType?: string;
  href?: string;
  createdAt: string;
  readAt?: string;
}

const notificationIcon = (type: string) => {
  switch (type) {
    case "transcription_complete":
    case "transcription_completed":
    case "transcript_generated":
      return Mic;
    case "document_generated":
      return FileText;
    case "document_regenerated":
      return RefreshCw;
    case "case_email_sent":
      return Mail;
    case "consent_given":
    case "consent_confirmed":
    case "pre_consent_acknowledged":
    case "pre_consent_declined":
    case "document_acknowledged":
      return Shield;
    case "pre_consent_reschedule_requested":
    case "meeting_booking_confirmed":
    case "meeting_booking_declined":
    case "meeting_booking_expired":
    case "meeting_reminder":
    case "deadline_approaching":
      return Calendar;
    case "audio_expiring":
    case "audio_expiring_soon":
    case "meeting_recording_failed":
      return AlertCircle;
    case "case_handover_received":
    case "firm_invite_accepted":
      return Users;
    default:
      return Bell;
  }
};

const notificationColor = (type: string) => {
  switch (type) {
    case "audio_expiring":
    case "audio_expiring_soon":
    case "pre_consent_declined":
      return "text-red-500";
    case "deadline_approaching":
    case "meeting_reminder":
    case "pre_consent_reschedule_requested":
    case "meeting_booking_declined":
    case "meeting_booking_expired":
    case "meeting_recording_failed":
      return "text-amber-500";
    case "consent_given":
    case "consent_confirmed":
    case "pre_consent_acknowledged":
    case "meeting_booking_confirmed":
    case "document_acknowledged":
    case "firm_invite_accepted":
      return "text-emerald-500";
    case "transcription_complete":
    case "transcription_completed":
    case "transcript_generated":
    case "document_generated":
    case "document_regenerated":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
};

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const hasScrollableList = notifications.length > 6;

  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // Ignore clicks on the bell trigger (handled separately)
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-testid="button-notifications"]')) return;
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NOTIFICATIONS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const evtSource = new EventSource("/api/notifications/stream", { withCredentials: true });
    evtSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    };
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, []);

  const openNotification = (notification: Notification) => {
    const href =
      notification.href ||
      (notification.caseId ? `/case/${notification.caseId}` : undefined);

    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }
    setOpen(false);

    if (!href) return;

    if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    setLocation(href);
  };

  const panel = open ? (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/40"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        className={cn(
          "fixed z-[80] overflow-hidden rounded-2xl border border-[#e6ddd0] bg-white shadow-2xl dark:border-border dark:bg-popover",
          "left-3 right-3 w-auto",
          // Mobile: above bottom nav; desktop: near top-right under nav
          "bottom-[max(5.5rem,calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem))] max-h-[min(70dvh,calc(100dvh-8rem))]",
          "sm:bottom-auto sm:left-auto sm:right-4 sm:top-[calc(4rem+env(safe-area-inset-top,0px)+0.5rem)] sm:w-96 sm:max-w-96 sm:max-h-[min(31rem,calc(100dvh-5.5rem))] sm:rounded-xl",
        )}
        role="dialog"
        aria-label="Notifications"
        data-testid="panel-notifications"
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#e8dfd2] bg-white px-3 py-3 sm:gap-3 sm:px-4 dark:border-border dark:bg-popover">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {hasScrollableList && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Showing latest notifications. Scroll for older updates.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs px-2 gap-1 sm:h-7"
                onClick={() => markAllReadMutation.mutate()}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 sm:h-7 sm:w-7"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
            >
              <X className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
            </Button>
          </div>
        </div>

        <div
          className="max-h-[min(27rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d4c8b8] dark:[&::-webkit-scrollbar-thumb]:bg-border"
          data-testid="notifications-scroll"
        >
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Bell className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-[16rem]">
                Updates on your cases will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {notifications.map((notification) => {
                const Icon = notificationIcon(notification.type);
                const iconColor = notificationColor(notification.type);
                const isUnread = !notification.readAt;
                const canOpen = !!(notification.href || notification.caseId);

                return (
                  <div
                    key={notification.id}
                    role={canOpen ? "button" : undefined}
                    tabIndex={canOpen ? 0 : undefined}
                    onClick={() => {
                      if (canOpen) openNotification(notification);
                    }}
                    onKeyDown={(e) => {
                      if (!canOpen) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openNotification(notification);
                      }
                    }}
                    className={`flex min-h-20 items-start gap-3 rounded-lg border px-3 py-3 shadow-sm transition-colors ${
                      canOpen ? "cursor-pointer" : ""
                    } dark:hover:bg-accent/20 ${
                      isUnread
                        ? "border-[#dec27b] bg-white hover:bg-[#fff8e7] dark:border-amber-500/30 dark:bg-card dark:hover:bg-amber-500/10"
                        : "border-[#e8dfd2] bg-white hover:bg-[#fbf7ef] dark:border-border dark:bg-card"
                    }`}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4ede2] dark:bg-muted ${iconColor}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground leading-tight">
                            {notification.title}
                          </p>
                          {notification.caseTitle && (
                            <p className="mt-0.5 text-[11px] font-medium text-foreground/70 truncate">
                              {notification.caseTitle}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 -mr-1 -mt-0.5 sm:h-5 sm:w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              markReadMutation.mutate(notification.id);
                            }}
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed break-words">
                        {notification.message}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="text-[10px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {canOpen && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            Open
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-primary-foreground relative"
        onClick={() => setOpen((o) => !o)}
        data-testid="button-notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            data-testid="badge-notification-count"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {typeof document !== "undefined" && panel
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
