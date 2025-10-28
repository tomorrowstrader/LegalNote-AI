import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, AlertCircle } from "lucide-react";
import type { FirmProfile } from "@shared/schema";

export default function FirmSetupPrompt() {
  const { user } = useAuth();
  const isAdmin = (user as any)?.isAdmin === true;
  const [_location, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data: firmProfile, isLoading } = useQuery<FirmProfile>({
    queryKey: ['/api/firm-profile'],
    enabled: isAdmin,
  });

  // Check if firm profile is incomplete
  const isIncomplete = firmProfile && !firmProfile.firmName;
  
  // Show modal only if:
  // 1. User is admin
  // 2. Profile loaded and is incomplete
  // 3. Not dismissed this session
  // 4. Not already on settings page
  const [currentPath] = useLocation();
  const shouldShow = isAdmin && !isLoading && isIncomplete && !dismissed && currentPath !== '/settings';

  const handleSetup = () => {
    navigate('/settings');
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <Dialog open={shouldShow} onOpenChange={handleDismiss}>
      <DialogContent data-testid="dialog-firm-setup" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-accent" />
            </div>
          </div>
          <DialogTitle className="text-xl">Complete Firm Setup</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Your firm profile needs to be set up before you can start using LegalNote AI. This information will appear on all exported documents.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-4 my-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">Required Information:</p>
              <ul className="text-amber-800 dark:text-amber-200 space-y-1">
                <li>• Firm name</li>
                <li>• Business address</li>
                <li>• Contact details</li>
                <li>• SRA number</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Button
            onClick={handleSetup}
            className="flex-1 bg-accent hover:bg-accent"
            data-testid="button-setup-now"
          >
            Set Up Now
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1"
            data-testid="button-setup-later"
          >
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
