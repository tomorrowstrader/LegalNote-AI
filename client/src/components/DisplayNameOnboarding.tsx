import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getApiErrorMessage } from "@/lib/queryClient";
import { Loader2, UserRound } from "lucide-react";

/**
 * First-run display name confirmation. OAuth often returns a messy given/family
 * name (especially personal Microsoft accounts). Users confirm once; after that
 * changing it requires an administrator.
 */
export default function DisplayNameOnboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.displayNameConfirmedAt) {
      setOpen(false);
      return;
    }
    setFirstName(user.firstName?.trim() || "");
    setLastName(user.lastName?.trim() || "");
    setOpen(true);
  }, [authLoading, user]);

  const confirmMutation = useMutation({
    mutationFn: async (names: { firstName: string; lastName: string }) => {
      return apiRequest("PATCH", "/api/user/display-name", names);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Display name saved",
        description: "Your name is locked. Contact an administrator if you need to change it later.",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save name",
        description: getApiErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    !confirmMutation.isPending;

  const handleConfirm = () => {
    if (!canSubmit) return;
    confirmMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });
  };

  if (authLoading || !user || user.displayNameConfirmedAt || !open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* required — dismiss only after confirm */ }}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        data-testid="dialog-display-name-onboarding"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-accent" />
            Confirm your full name
          </DialogTitle>
          <DialogDescription>
            Sign-in providers sometimes get this wrong. Enter the name you want shown across
            LegalNote — on attendance notes, team lists, and your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="onboarding-first-name">First name</Label>
            <Input
              id="onboarding-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              data-testid="input-onboarding-first-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-last-name">Last name</Label>
            <Input
              id="onboarding-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              data-testid="input-onboarding-last-name"
            />
          </div>
          <Alert>
            <AlertDescription className="text-sm">
              Once confirmed, your display name is locked. Changing it later requires contacting
              an administrator.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-testid="button-confirm-display-name"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm name"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
