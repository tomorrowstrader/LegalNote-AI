import { Shield, CheckCircle2, Lock, FileCheck, Clock, Wifi, HardDrive, FileText, Eye, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SafeguardItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  status: "active" | "info";
}

const safeguards: SafeguardItem[] = [
  {
    name: "Chunked Upload Protection",
    description: "Audio saved every 10 seconds - max 10 sec loss on failure",
    icon: <HardDrive className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Network Monitoring",
    description: "Real-time connectivity status during recording",
    icon: <Wifi className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Session Auto-Extension",
    description: "Session stays active during recording",
    icon: <Clock className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Document Integrity",
    description: "SHA-256 hashes verify document authenticity",
    icon: <FileCheck className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Consent Preservation",
    description: "First 15 seconds preserved for GDPR compliance",
    icon: <FileText className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Tamper-Proof Audit",
    description: "Cryptographically signed activity logs",
    icon: <Eye className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Secure Sessions",
    description: "4-hour timeout with 5-min warning",
    icon: <Lock className="w-4 h-4" />,
    status: "active",
  },
  {
    name: "Auto-Save Documents",
    description: "30-second auto-save with local backup recovery",
    icon: <Save className="w-4 h-4" />,
    status: "active",
  },
];

export function SafeguardsStatus() {
  return (
    <Card className="border-green-500/20 bg-green-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">Recording Safeguards</CardTitle>
            <CardDescription className="text-xs">All protection layers active</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          {safeguards.map((safeguard) => (
            <Tooltip key={safeguard.name}>
              <TooltipTrigger>
                <div 
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 cursor-help"
                  data-testid={`badge-safeguard-${safeguard.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {safeguard.name.split(' ')[0]}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px]">
                <p className="font-medium text-xs">{safeguard.name}</p>
                <p className="text-xs text-muted-foreground">{safeguard.description}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Your recordings are protected with {safeguards.length} layers of security
        </p>
      </CardContent>
    </Card>
  );
}

export function SafeguardsStatusCompact() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 cursor-help" data-testid="indicator-safeguards-compact">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-medium">{safeguards.length} Safeguards Active</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[280px]">
        <p className="font-medium text-sm mb-2">Recording Protection Active</p>
        <ul className="text-xs space-y-1">
          {safeguards.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span>{s.name}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
