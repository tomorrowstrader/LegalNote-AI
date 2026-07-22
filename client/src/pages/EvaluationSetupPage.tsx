import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { SecondaryPageHeader } from "@/components/SecondaryPageHeader";
import { LegalPageFooter } from "@/components/LegalPageFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, getApiErrorMessage } from "@/lib/queryClient";

const MEETING_TYPE_OPTIONS = [
  { id: "in_person", label: "In person" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "zoom", label: "Zoom" },
  { id: "phone", label: "Phone" },
  { id: "other", label: "Other" },
] as const;

type SetupPayload = {
  status: string;
  firmName: string;
  signerName: string;
  signerEmail: string;
  feeEarnerCount: number;
  evaluationPeriodDays: number;
  sraNumberFromAcceptance: string | null;
  expiresAt: string;
  submittedAt: string | null;
};

function buildFormSchema(maxFeeEarners: number) {
  return z
    .object({
      onboardingOwnerName: z.string().min(1, "Required").max(200),
      onboardingOwnerEmail: z.string().email().max(255),
      onboardingOwnerPhone: z.string().min(1, "Required").max(50),
      operationalSameAsOwner: z.boolean(),
      operationalContactName: z.string().max(200).optional(),
      operationalContactEmail: z.string().max(255).optional(),
      dpContactName: z.string().min(1, "Required").max(200),
      dpContactEmail: z.string().email().max(255),
      dpContactRole: z.string().min(1, "Required").max(100),
      firmLegalName: z.string().min(1, "Required").max(300),
      companiesHouseNumber: z.string().min(1, "Required").max(20),
      sraNumber: z.string().min(1, "Required").max(50),
      feeEarners: z
        .array(
          z.object({
            name: z.string().min(1, "Required").max(200),
            email: z.string().email().max(255),
          }),
        )
        .min(1)
        .max(maxFeeEarners),
      primaryAdminName: z.string().min(1, "Required").max(200),
      primaryAdminEmail: z.string().email().max(255),
      preferredGoLive: z.string().min(1, "Required").max(500),
      authGoogle: z.boolean(),
      authMicrosoft: z.boolean(),
      practiceAreas: z.string().max(500).optional(),
      meetingTypes: z.array(z.string()).default([]),
      letterheadPhone: z.string().max(50).optional(),
      letterheadEmail: z.string().max(255).optional(),
      letterheadAddress: z.string().max(500).optional(),
      firstUseAttendeeName: z.string().max(200).optional(),
      firstUseCalendarPreference: z.string().max(200).optional(),
      internalChecksConfirmed: z.literal(true, {
        errorMap: () => ({ message: "Required to continue" }),
      }),
    })
    .superRefine((data, ctx) => {
      if (!data.authGoogle && !data.authMicrosoft) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Select at least one sign-in method",
          path: ["authGoogle"],
        });
      }
      if (!data.operationalSameAsOwner) {
        if (!data.operationalContactName?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Required",
            path: ["operationalContactName"],
          });
        }
        if (!data.operationalContactEmail?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Required",
            path: ["operationalContactEmail"],
          });
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.operationalContactEmail)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Invalid email",
            path: ["operationalContactEmail"],
          });
        }
      }
      if (data.letterheadEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.letterheadEmail)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid email",
          path: ["letterheadEmail"],
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

export default function EvaluationSetupPage() {
  const { token } = useParams<{ token: string }>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Evaluation setup - LegalNote";
  }, []);

  const { data, isLoading, isError, error } = useQuery<SetupPayload>({
    queryKey: ["/api/evaluation/setup", token],
    queryFn: async () => {
      const res = await fetch(`/api/evaluation/setup/${token}`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invalid or expired setup link");
      }
      return res.json();
    },
    enabled: Boolean(token),
    retry: false,
  });

  const schema = useMemo(
    () => buildFormSchema(data?.feeEarnerCount ?? 1),
    [data?.feeEarnerCount],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      onboardingOwnerName: "",
      onboardingOwnerEmail: "",
      onboardingOwnerPhone: "",
      operationalSameAsOwner: true,
      operationalContactName: "",
      operationalContactEmail: "",
      dpContactName: "",
      dpContactEmail: "",
      dpContactRole: "",
      firmLegalName: "",
      companiesHouseNumber: "",
      sraNumber: "",
      feeEarners: [{ name: "", email: "" }],
      primaryAdminName: "",
      primaryAdminEmail: "",
      preferredGoLive: "",
      authGoogle: true,
      authMicrosoft: true,
      practiceAreas: "",
      meetingTypes: [],
      letterheadPhone: "",
      letterheadEmail: "",
      letterheadAddress: "",
      firstUseAttendeeName: "",
      firstUseCalendarPreference: "",
      internalChecksConfirmed: undefined as unknown as true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "feeEarners",
  });

  useEffect(() => {
    if (!data) return;
    form.reset({
      ...form.getValues(),
      onboardingOwnerName: data.signerName || "",
      onboardingOwnerEmail: data.signerEmail || "",
      firmLegalName: data.firmName || "",
      sraNumber: data.sraNumberFromAcceptance || "",
      feeEarners: [{ name: data.signerName || "", email: data.signerEmail || "" }],
      primaryAdminName: data.signerName || "",
      primaryAdminEmail: data.signerEmail || "",
      authGoogle: true,
      authMicrosoft: true,
      operationalSameAsOwner: true,
      meetingTypes: [],
    });
  }, [data?.firmName, data?.signerEmail, data?.signerName, data?.sraNumberFromAcceptance]);

  const operationalSame = form.watch("operationalSameAsOwner");
  const maxEarners = data?.feeEarnerCount ?? 1;

  const submitMutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiRequest("POST", `/api/evaluation/setup/${token}`, {
        ...values,
        letterheadEmail: values.letterheadEmail?.trim() || undefined,
        operationalContactEmail: values.operationalSameAsOwner
          ? undefined
          : values.operationalContactEmail?.trim() || undefined,
        operationalContactName: values.operationalSameAsOwner
          ? undefined
          : values.operationalContactName?.trim() || undefined,
      }),
    onSuccess: () => setDone(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
        <SecondaryPageHeader />
        <main className="max-w-xl mx-auto px-6 py-16">
          <h1 className="text-2xl font-semibold mb-2">Setup link unavailable</h1>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "Invalid or expired link."}
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Contact jazz.dennis@legalnote.ai if you need a new link.
          </p>
        </main>
        <LegalPageFooter />
      </div>
    );
  }

  if (data.status === "submitted" || done) {
    return (
      <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
        <SecondaryPageHeader />
        <main className="max-w-xl mx-auto px-6 py-16 space-y-4">
          <h1 className="text-2xl font-semibold">Thank you</h1>
          <p className="text-muted-foreground">
            Setup details for <strong>{data.firmName}</strong> have been received. We will
            configure your evaluation account and confirm the configuration date in writing,
            then arrange your guided first-use session.
          </p>
          <p className="text-sm text-muted-foreground">
            Questions? Email jazz.dennis@legalnote.ai.
          </p>
        </main>
        <LegalPageFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)] dark:bg-background">
      <SecondaryPageHeader />
      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-2">
            Evaluation setup
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">{data.firmName}</h1>
          <p className="text-muted-foreground text-sm">
            Key Terms: {data.evaluationPeriodDays} days · up to {data.feeEarnerCount} fee
            earner{data.feeEarnerCount === 1 ? "" : "s"}. The evaluation period starts on the
            configuration date once we complete setup.
          </p>
        </div>

        <Form {...form}>
          <form
            className="space-y-10"
            onSubmit={form.handleSubmit((values) => submitMutation.mutate(values))}
          >
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Onboarding owner</h2>
              <FormField
                control={form.control}
                name="onboardingOwnerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="onboardingOwnerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="onboardingOwnerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone / mobile</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Operational contact</h2>
              <FormField
                control={form.control}
                name="operationalSameAsOwner"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Same as onboarding owner</FormLabel>
                  </FormItem>
                )}
              />
              {!operationalSame && (
                <>
                  <FormField
                    control={form.control}
                    name="operationalContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="operationalContactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Data protection contact</h2>
              <FormField
                control={form.control}
                name="dpContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dpContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dpContactRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. COLP, DPO, IT" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Firm identifiers</h2>
              <FormField
                control={form.control}
                name="firmLegalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="companiesHouseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Companies House number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sraNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SRA number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Nominated fee earners</h2>
                  <p className="text-sm text-muted-foreground">
                    Up to {maxEarners} under your signed Key Terms.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fields.length >= maxEarners}
                  onClick={() => append({ name: "", email: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <FormField
                    control={form.control}
                    name={`feeEarners.${index}.name`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className={index > 0 ? "sr-only" : undefined}>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Name" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`feeEarners.${index}.email`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel className={index > 0 ? "sr-only" : undefined}>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                    aria-label="Remove fee earner"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Primary admin</h2>
              <p className="text-sm text-muted-foreground">
                First login and invitation rights for the firm account.
              </p>
              <FormField
                control={form.control}
                name="primaryAdminName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryAdminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Go-live &amp; sign-in</h2>
              <FormField
                control={form.control}
                name="preferredGoLive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred go-live window</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Week of 4 Aug, or ASAP"
                        rows={2}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Sign-in methods for nominated users</Label>
                <FormField
                  control={form.control}
                  name="authGoogle"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Google</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="authMicrosoft"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Microsoft</FormLabel>
                    </FormItem>
                  )}
                />
                {form.formState.errors.authGoogle && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.authGoogle.message}
                  </p>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Practice context</h2>
              <FormField
                control={form.control}
                name="practiceAreas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Practice areas in scope (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. private client, conveyancing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="meetingTypes"
                render={() => (
                  <FormItem>
                    <FormLabel>Typical meeting types</FormLabel>
                    <div className="flex flex-wrap gap-4 pt-1">
                      {MEETING_TYPE_OPTIONS.map((opt) => (
                        <FormField
                          key={opt.id}
                          control={form.control}
                          name="meetingTypes"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(opt.id)}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...(field.value || []), opt.id]
                                      : (field.value || []).filter((v) => v !== opt.id);
                                    field.onChange(next);
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">{opt.label}</FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Letterhead (optional)</h2>
              <FormField
                control={form.control}
                name="letterheadPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="letterheadEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="letterheadAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormDescription>Logo can be uploaded later in Settings.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Guided first-use session</h2>
              <FormField
                control={form.control}
                name="firstUseAttendeeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who should attend (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstUseCalendarPreference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calendar / scheduling preference (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Calendly link, or mornings preferred" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <FormField
              control={form.control}
              name="internalChecksConfirmed"
              render={({ field }) => (
                <FormItem className="flex gap-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(v) => field.onChange(v === true ? true : undefined)}
                    />
                  </FormControl>
                  <div className="space-y-1">
                    <FormLabel className="font-normal leading-snug">
                      We confirm no client data will be uploaded until we have completed any
                      internal checks we consider necessary, and nominated users understand that
                      platform output is a draft until Adoption.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {submitMutation.isError && (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(submitMutation.error, "Could not submit setup.")}
              </p>
            )}

            <Button type="submit" disabled={submitMutation.isPending} className="w-full sm:w-auto">
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit setup details"
              )}
            </Button>
          </form>
        </Form>
      </main>
      <LegalPageFooter />
    </div>
  );
}
