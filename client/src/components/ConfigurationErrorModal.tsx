import { useLocation } from "wouter";
import { AlertCircle, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfigurationErrorType = 
  | 'calendar_not_connected'
  | 'clio_not_connected'
  | 'sharepoint_not_connected'
  | 'api_key_missing'
  | 'custom';

interface ConfigurationErrorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errorType: ConfigurationErrorType;
  title?: string;
  description?: string;
  settingsPath?: string;
  settingsTab?: string;
}

const ERROR_CONFIGS: Record<ConfigurationErrorType, { title: string; description: string; tab: string }> = {
  calendar_not_connected: {
    title: "Calendar Not Connected",
    description: "Connect your Google Calendar or Outlook to automatically sync meetings and deadlines. This allows you to see upcoming video calls and sync case deadlines.",
    tab: "integrations",
  },
  clio_not_connected: {
    title: "Clio Not Connected", 
    description: "Connect your Clio Manage account to import matters and link cases. This streamlines your workflow by syncing client and matter information.",
    tab: "integrations",
  },
  sharepoint_not_connected: {
    title: "SharePoint/OneDrive Not Connected",
    description: "Connect Microsoft SharePoint or OneDrive to automatically back up your documents to the cloud. This ensures your case files are safely stored.",
    tab: "integrations",
  },
  api_key_missing: {
    title: "API Key Required",
    description: "An API key is required for this feature. Please configure it in your settings.",
    tab: "integrations",
  },
  custom: {
    title: "Configuration Required",
    description: "Please update your settings to enable this feature.",
    tab: "integrations",
  },
};

export default function ConfigurationErrorModal({
  open,
  onOpenChange,
  errorType,
  title,
  description,
  settingsPath = "/settings",
  settingsTab,
}: ConfigurationErrorModalProps) {
  const [, setLocation] = useLocation();
  
  const config = ERROR_CONFIGS[errorType];
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const tab = settingsTab || config.tab;

  const handleGoToSettings = () => {
    const targetPath = tab ? `${settingsPath}?tab=${tab}` : settingsPath;
    setLocation(targetPath);
    onOpenChange(false);
    
    sessionStorage.setItem(`dismissed_config_error_${errorType}`, 'true');
  };

  const handleDismiss = () => {
    sessionStorage.setItem(`dismissed_config_error_${errorType}`, 'true');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            {displayTitle}
          </DialogTitle>
          <DialogDescription className="text-left">
            {displayDescription}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDismiss} data-testid="button-dismiss-config-error">
            <X className="w-4 h-4 mr-2" />
            Dismiss
          </Button>
          <Button onClick={handleGoToSettings} data-testid="button-go-to-settings">
            <Settings className="w-4 h-4 mr-2" />
            Go to Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfigurationErrorModal(errorType: ConfigurationErrorType) {
  const isDismissed = sessionStorage.getItem(`dismissed_config_error_${errorType}`) === 'true';
  
  const clearDismissal = () => {
    sessionStorage.removeItem(`dismissed_config_error_${errorType}`);
  };
  
  return { isDismissed, clearDismissal };
}
