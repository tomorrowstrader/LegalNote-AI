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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  firmName: z.string().optional(),
  firmSize: z.string().optional(),
  role: z.string().optional(),
  gdprConsent: z.boolean().refine(val => val === true, {
    message: "You must consent to data processing to join the waitlist"
  }),
  marketingConsent: z.boolean().default(false),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

interface EarlyAccessFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source?: string;
}

export function EarlyAccessForm({ open, onOpenChange, source = "landing_page" }: EarlyAccessFormProps) {
  const [success, setSuccess] = useState(false);

  const form = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      firmName: "",
      firmSize: "",
      role: "",
      gdprConsent: false,
      marketingConsent: false,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: WaitlistFormData) => {
      const response = await apiRequest("POST", "/api/waitlist", {
        ...data,
        source,
      });
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const onSubmit = (data: WaitlistFormData) => {
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
      <DialogContent className="sm:max-w-md">
        {success ? (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogHeader>
              <DialogTitle data-testid="text-success-title">You're on the List</DialogTitle>
              <DialogDescription data-testid="text-success-description">
                We'll notify you as soon as early access becomes available. Check your inbox for a confirmation email.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={handleClose} className="mt-6" data-testid="button-close-success">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-form-title">Request Early Access</DialogTitle>
              <DialogDescription data-testid="text-form-description">
                We're currently in private beta. Join our waitlist to be among the first to experience LegalNote™.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="you@yourfirm.co.uk" 
                          type="email" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Smith" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="firmName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firm Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Smith & Associates LLP" {...field} data-testid="input-firm-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firmSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Firm Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-firm-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="solo">Solo practitioner</SelectItem>
                            <SelectItem value="2-5">2-5 solicitors</SelectItem>
                            <SelectItem value="6-10">6-10 solicitors</SelectItem>
                            <SelectItem value="10+">10+ solicitors</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="solicitor">Solicitor</SelectItem>
                            <SelectItem value="partner">Partner</SelectItem>
                            <SelectItem value="compliance_colp">Compliance/COLP</SelectItem>
                            <SelectItem value="it_admin">IT/Operations</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <FormField
                    control={form.control}
                    name="gdprConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-gdpr"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            I consent to LegalNote™ processing my data to manage my waitlist registration and send me updates about early access. *
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketingConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-marketing"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          I'd like to receive occasional insights about legal tech, compliance tips, and product updates.
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {submitMutation.isError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{(submitMutation.error as any)?.message || "Something went wrong. Please try again."}</span>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-waitlist"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Joining Waitlist...
                    </>
                  ) : (
                    "Join Waitlist"
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Your data is stored securely and never shared with third parties.
                </p>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
