import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Download, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const leadMagnetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  gdprConsent: z.boolean().refine(val => val === true, {
    message: "You must consent to receive the guide"
  }),
});

type LeadMagnetFormData = z.infer<typeof leadMagnetSchema>;

interface LeadMagnetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadMagnetForm({ open, onOpenChange }: LeadMagnetFormProps) {
  const [success, setSuccess] = useState(false);

  const form = useForm<LeadMagnetFormData>({
    resolver: zodResolver(leadMagnetSchema),
    defaultValues: {
      email: "",
      firstName: "",
      gdprConsent: false,
    },
  });

  const triggerPdfDownload = (firstName: string) => {
    const downloadUrl = `/api/lead-magnet/download?name=${encodeURIComponent(firstName)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'LegalNote-Defensible-Record-Guide.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const submitMutation = useMutation({
    mutationFn: async (data: LeadMagnetFormData) => {
      const response = await apiRequest("POST", "/api/waitlist", {
        ...data,
        lastName: "",
        firmName: "",
        firmSize: "",
        role: "",
        marketingConsent: true,
        source: "lead_magnet",
      });
      return { ...await response.json(), firstName: data.firstName };
    },
    onSuccess: (data) => {
      setSuccess(true);
      triggerPdfDownload(data.firstName || '');
    },
    onError: (error: Error) => {
      if (error.message?.includes("already")) {
        setSuccess(true);
        triggerPdfDownload(form.getValues('firstName') || '');
      } else {
        console.error("Lead magnet submission error:", error);
      }
    },
  });

  const onSubmit = (data: LeadMagnetFormData) => {
    submitMutation.mutate(data);
  };

  const handleClose = () => {
    onOpenChange(false);
    if (success) {
      setTimeout(() => {
        setSuccess(false);
        form.reset();
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] sm:max-w-md mx-auto rounded-xl">
        {success ? (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogHeader>
              <DialogTitle data-testid="text-pdf-success-title">Your Guide is Downloading</DialogTitle>
              <DialogDescription data-testid="text-pdf-success-description">
                Your 5-page compliance guide should be downloading now. We've also sent a copy to your inbox.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="mt-6" data-testid="button-close-pdf-success">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-[hsl(18,70%,42%)] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle data-testid="text-pdf-form-title" className="text-left">
                    Get Your Free Guide
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground text-left">5-page PDF</p>
                </div>
              </div>
              <DialogDescription data-testid="text-pdf-form-description" className="text-left">
                "5 Documentation Gaps That Trigger PI Claims" - practical steps to protect your practice.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John" 
                          {...field} 
                          data-testid="input-pdf-first-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="you@yourfirm.co.uk" 
                          type="email" 
                          {...field} 
                          data-testid="input-pdf-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gdprConsent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-pdf-consent"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal text-muted-foreground">
                          Send me the guide and occasional updates about LegalNote
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-[hsl(18,70%,42%)] text-white"
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-pdf"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Send My Free Guide
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  We respect your privacy. Unsubscribe anytime.
                </p>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
