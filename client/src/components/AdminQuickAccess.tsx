import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, RotateCcw, FileDown, Settings, Users, Loader2, CheckSquare, ClipboardList, Link2, FileCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export default function AdminQuickAccess() {
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDemoReset = async () => {
    setIsResetting(true);
    try {
      const data = await apiRequest<{ success: boolean; message?: string; casesCreated?: number }>("POST", "/api/demo/reset");
      if (data.success) {
        toast({
          title: "Demo Reset Complete",
          description: `Patterson demo case reseeded successfully. ${data.casesCreated ?? ""} cases created.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/audit/logs"] });
      } else {
        toast({
          title: "Reset Failed",
          description: data.message || "Could not reset demo data.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Reset Failed",
        description: "An error occurred while resetting demo data.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setConfirmReset(false);
      setOpen(false);
    }
  };

  const handleExportAuditTrail = async () => {
    try {
      const res = await fetch("/api/audit/logs");
      if (!res.ok) throw new Error("Failed to fetch audit trail");
      const logs = await res.json();

      if (!logs.length) {
        toast({
          title: "No Audit Data",
          description: "No audit trail entries to export.",
        });
        return;
      }

      const headers = Object.keys(logs[0] as Record<string, unknown>);
      const csvRows = [
        headers.join(","),
        ...logs.map((row: Record<string, unknown>) =>
          headers.map((h) => {
            const val = row[h];
            const str = val === null || val === undefined ? "" : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(",")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Audit Trail Exported",
        description: `Exported ${logs.length} audit log entries.`,
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Failed to export audit trail.",
        variant: "destructive",
      });
    }
    setOpen(false);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) setConfirmReset(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground relative"
          data-testid="button-admin-quick-access"
        >
          <ShieldCheck className="w-5 h-5" />
          <Badge
            variant="outline"
            className="absolute -top-1 -right-1 text-[9px] leading-none border-primary-foreground/40 text-primary-foreground/80 no-default-hover-elevate no-default-active-elevate scale-75"
          >
            ADM
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Admin Quick Access</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {!confirmReset ? (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmReset(true);
            }}
            disabled={isResetting}
            data-testid="menu-item-demo-reset"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Demo Data
          </DropdownMenuItem>
        ) : (
          <div className="px-2 py-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              This will clear and reseed the Patterson demo case. Continue?
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDemoReset}
                disabled={isResetting}
                data-testid="button-confirm-demo-reset"
              >
                {isResetting ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                {isResetting ? "Resetting..." : "Confirm Reset"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmReset(false)}
                disabled={isResetting}
                data-testid="button-cancel-demo-reset"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleExportAuditTrail();
          }}
          data-testid="menu-item-audit-export"
        >
          <FileDown className="w-4 h-4 mr-2" />
          Export Audit Trail (CSV)
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild data-testid="menu-item-admin-firm-settings">
          <Link href="/settings">
            <Settings className="w-4 h-4 mr-2" />
            Firm Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-user-management">
          <Link href="/admin">
            <Users className="w-4 h-4 mr-2" />
            User Management
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-provision-firm">
          <Link href="/admin/provision-firm">
            <Building2 className="w-4 h-4 mr-2" />
            Provision evaluation firm
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-dpa-mint">
          <Link href="/admin/dpa-mint">
            <Link2 className="w-4 h-4 mr-2" />
            Mint DPA Link
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-dpa-acceptances">
          <Link href="/admin/dpa-acceptances">
            <FileCheck className="w-4 h-4 mr-2" />
            DPA Acceptances
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-undertakings">
          <Link href="/my-actions">
            <CheckSquare className="w-4 h-4 mr-2" />
            Undertakings Dashboard
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild data-testid="menu-item-admin-audit-logs">
          <Link href="/audit-logs">
            <ClipboardList className="w-4 h-4 mr-2" />
            Audit Logs
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
