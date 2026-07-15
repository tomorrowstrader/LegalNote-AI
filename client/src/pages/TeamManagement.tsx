import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, UserPlus, Mail, Shield, Clock, UserX, ChevronDown, Building2, AlertCircle, CheckCircle2, RotateCcw, FileText } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const PRIMARY_ROLES = [
  { value: "managing_partner", label: "Managing Partner" },
  { value: "partner", label: "Partner" },
  { value: "legal_director", label: "Legal Director" },
  { value: "senior_solicitor", label: "Senior Solicitor" },
  { value: "solicitor", label: "Solicitor" },
  { value: "associate", label: "Associate" },
  { value: "trainee_solicitor", label: "Trainee Solicitor" },
  { value: "legal_executive", label: "Legal Executive (CILEx)" },
  { value: "consultant", label: "Consultant Solicitor" },
  { value: "paralegal", label: "Paralegal" },
  { value: "licensed_conveyancer", label: "Licensed Conveyancer" },
  { value: "costs_lawyer", label: "Costs Lawyer" },
  { value: "practice_manager", label: "Practice Manager" },
  { value: "compliance_manager", label: "Compliance Manager" },
  { value: "accounts_finance", label: "Accounts and Finance" },
  { value: "legal_secretary", label: "Legal Secretary" },
  { value: "firm_admin_only", label: "Firm Administrator" },
  { value: "custom", label: "Custom" },
];

const REGULATORY_DESIGNATIONS = [
  { value: "is_colp", label: "Compliance Officer for Legal Practice (COLP)" },
  { value: "is_cofa", label: "Compliance Officer for Finance and Administration (COFA)" },
  { value: "is_mlro", label: "Money Laundering Reporting Officer (MLRO)" },
  { value: "is_supervisor", label: "Supervising Solicitor" },
  { value: "is_firm_admin", label: "Firm Administrator" },
];

function getRoleLabel(role: string | null | undefined, customLabel: string | null | undefined): string {
  if (!role) return "No role set";
  if (role === "custom") return customLabel || "Custom";
  return PRIMARY_ROLES.find(r => r.value === role)?.label ?? role;
}

function getDesignationLabels(designations: string[] | null | undefined): string[] {
  if (!designations || designations.length === 0) return [];
  return designations
    .filter(d => d !== "is_firm_admin")
    .map(d => REGULATORY_DESIGNATIONS.find(r => r.value === d)?.label ?? d);
}

function getUserInitials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

interface TeamMember {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  primaryRole: string | null;
  customRoleLabel: string | null;
  regulatoryDesignations: string[] | null;
  inviteStatus: string | null;
  invitedAt: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
}

interface Invitation {
  id: string;
  email: string;
  suggestedRole: string | null;
  suggestedCustomRoleLabel: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface RoleLog {
  id: string;
  userId: string;
  changedByUserId: string;
  previousRole: string | null;
  newRole: string | null;
  previousDesignations: string[];
  newDesignations: string[];
  previousCustomRoleLabel: string | null;
  newCustomRoleLabel: string | null;
  reason: string | null;
  createdAt: string;
  user?: { firstName: string | null; lastName: string | null; email: string | null };
  changedBy?: { firstName: string | null; lastName: string | null; email: string | null };
}

interface Firm {
  id: string;
  name: string;
  sraNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  suggestedRole: z.string().optional(),
  authProvider: z.enum(["google", "microsoft"]).default("google"),
});

const roleSchema = z.object({
  primaryRole: z.string().optional(),
  customRoleLabel: z.string().max(100).optional(),
  regulatoryDesignations: z.array(z.string()).optional(),
  reason: z.string().max(500).optional(),
});

const firmSchema = z.object({
  name: z.string().min(1, "Firm name is required").max(200),
  sraNumber: z.string().max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

function MemberCard({ member, currentUserId, isFirmAdmin, firmId, allMembers }: {
  member: TeamMember;
  currentUserId: string;
  isFirmAdmin: boolean;
  firmId: string;
  allMembers: TeamMember[];
}) {
  const { toast } = useToast();
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showOffboardDialog, setShowOffboardDialog] = useState(false);
  const [offboardActiveCases, setOffboardActiveCases] = useState<number | null>(null);
  const [offboardRequiresConfirmation, setOffboardRequiresConfirmation] = useState(false);
  const [offboardCases, setOffboardCases] = useState<{ id: string; title: string; matterReference: string | null }[]>([]);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const isSelf = member.id === currentUserId;

  const roleForm = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      primaryRole: member.primaryRole ?? undefined,
      customRoleLabel: member.customRoleLabel ?? undefined,
      regulatoryDesignations: member.regulatoryDesignations ?? [],
      reason: "",
    },
  });

  const primaryRole = roleForm.watch("primaryRole");
  const selectedDesignations = roleForm.watch("regulatoryDesignations") ?? [];

  const updateRoleMutation = useMutation({
    mutationFn: (data: z.infer<typeof roleSchema>) =>
      apiRequest("PATCH", `/api/team/members/${member.id}/role`, data),
    onSuccess: (response: { user: unknown; warnings?: string[] }) => {
      if (response.warnings && response.warnings.length > 0) {
        response.warnings.forEach((warning: string) => {
          toast({ title: "Role updated with a note", description: warning });
        });
      } else {
        toast({ title: "Role updated", description: "The team member's role has been updated." });
      }
      setShowRoleDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/role-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update role", description: err.message, variant: "destructive" });
    },
  });

  const offboardMutation = useMutation({
    mutationFn: async (payload?: Record<string, string>) => {
      const res = await fetch(`/api/team/members/${member.id}/offboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reassignments: payload ?? {} }),
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        const error = new Error(body.message || "Failed to offboard member") as Error & { responseBody?: typeof body };
        error.responseBody = body;
        throw error;
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "Member removed", description: "The team member has been offboarded." });
      setShowOffboardDialog(false);
      setOffboardActiveCases(null);
      setOffboardRequiresConfirmation(false);
      setOffboardCases([]);
      setReassignments({});
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members/former"] });
    },
    onError: (err: Error & { responseBody?: { requiresConfirmation?: boolean; activeCaseCount?: number; message?: string; cases?: { id: string; title: string; matterReference: string | null }[] } }) => {
      if (err.responseBody?.requiresConfirmation) {
        setOffboardActiveCases(err.responseBody.activeCaseCount ?? 0);
        setOffboardRequiresConfirmation(true);
        setOffboardCases(err.responseBody.cases ?? []);
      } else {
        toast({ title: "Failed to offboard member", description: err.message, variant: "destructive" });
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/team/members/${member.id}/activate`, {}),
    onSuccess: () => {
      toast({ title: "Member activated", description: "The team member has been approved and activated." });
      queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to activate member", description: err.message, variant: "destructive" });
    },
  });

  const designationLabels = getDesignationLabels(member.regulatoryDesignations);
  const isMemberFirmAdmin = (member.regulatoryDesignations ?? []).includes("is_firm_admin");

  return (
    <div className="flex items-start gap-4 py-4" data-testid={`card-member-${member.id}`}>
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={member.profileImageUrl ?? undefined} />
        <AvatarFallback>
          {getUserInitials(member.firstName, member.lastName, member.email)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm" data-testid={`text-member-name-${member.id}`}>
            {member.firstName && member.lastName
              ? `${member.firstName} ${member.lastName}`
              : member.email ?? "Unknown"}
          </span>
          {isSelf && <Badge variant="secondary" className="text-xs">You</Badge>}
          {isMemberFirmAdmin && (
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Firm Admin
            </Badge>
          )}
          {member.inviteStatus === "pending_approval" && (
            <Badge variant="secondary" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              Pending Approval
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">{member.email}</p>
        <p className="text-sm mt-0.5">
          {getRoleLabel(member.primaryRole, member.customRoleLabel)}
        </p>
        {designationLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {designationLabels.map(label => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        )}
        {member.createdAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Joined {format(new Date(member.createdAt), "d MMM yyyy")}
          </p>
        )}
      </div>

      {isFirmAdmin && !isSelf && (
        <div className="flex gap-2 shrink-0 flex-wrap">
          {member.inviteStatus === "pending_approval" && (
            <Button
              size="sm"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              data-testid={`button-activate-member-${member.id}`}
            >
              {activateMutation.isPending ? "Activating..." : "Activate"}
            </Button>
          )}
          <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid={`button-edit-role-${member.id}`}>
                Edit Role
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Role</DialogTitle>
                <DialogDescription>
                  Update the role and regulatory designations for{" "}
                  {member.firstName ? `${member.firstName} ${member.lastName}` : member.email}.
                </DialogDescription>
              </DialogHeader>
              <Form {...roleForm}>
                <form onSubmit={roleForm.handleSubmit(data => updateRoleMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={roleForm.control}
                    name="primaryRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Role</FormLabel>
                        <Select value={field.value ?? ""} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-primary-role-${member.id}`}>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIMARY_ROLES.map(role => (
                              <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {primaryRole === "custom" && (
                    <FormField
                      control={roleForm.control}
                      name="customRoleLabel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Custom Role Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Legal Operations Manager" {...field} data-testid={`input-custom-role-${member.id}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Regulatory Designations</Label>
                    <div className="space-y-2">
                      {REGULATORY_DESIGNATIONS.map(des => (
                        <div key={des.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`${member.id}-${des.value}`}
                            data-testid={`checkbox-designation-${des.value}-${member.id}`}
                            checked={selectedDesignations.includes(des.value)}
                            onCheckedChange={(checked) => {
                              const current = roleForm.getValues("regulatoryDesignations") ?? [];
                              if (checked) {
                                roleForm.setValue("regulatoryDesignations", [...current, des.value]);
                              } else {
                                roleForm.setValue("regulatoryDesignations", current.filter(d => d !== des.value));
                              }
                            }}
                          />
                          <label htmlFor={`${member.id}-${des.value}`} className="text-sm cursor-pointer">
                            {des.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <FormField
                    control={roleForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason for change (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Promoted to Senior Solicitor" {...field} data-testid={`input-role-reason-${member.id}`} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowRoleDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateRoleMutation.isPending} data-testid={`button-save-role-${member.id}`}>
                      {updateRoleMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={showOffboardDialog} onOpenChange={(open) => {
            setShowOffboardDialog(open);
            if (!open) {
              setOffboardActiveCases(null);
              setOffboardRequiresConfirmation(false);
              setOffboardCases([]);
              setReassignments({});
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid={`button-offboard-${member.id}`}>
                <UserX className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Remove Team Member</DialogTitle>
                <DialogDescription>
                  {offboardRequiresConfirmation && offboardActiveCases !== null ? (
                    <>
                      This member has <strong>{offboardActiveCases} open matter{offboardActiveCases === 1 ? "" : "s"}</strong> that must be reassigned before they can be removed.
                      Assign each matter to another team member below.
                    </>
                  ) : (
                    <>
                      Are you sure you want to remove{" "}
                      <strong>{member.firstName ? `${member.firstName} ${member.lastName}` : member.email}</strong>{" "}
                      from the firm? Their matters and documents will remain in the system.
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              {offboardRequiresConfirmation && offboardCases.length > 0 && (
                <div className="space-y-3 max-h-60 overflow-y-auto py-2">
                  {offboardCases.map(c => (
                    <div key={c.id} className="space-y-1">
                      <p className="text-sm font-medium truncate">{c.title}{c.matterReference ? ` (${c.matterReference})` : ""}</p>
                      <Select
                        value={reassignments[c.id] ?? ""}
                        onValueChange={(val) => setReassignments(prev => ({ ...prev, [c.id]: val }))}
                      >
                        <SelectTrigger data-testid={`select-reassign-${c.id}`} className="h-8 text-sm">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allMembers
                            .filter(m => m.id !== member.id && m.inviteStatus === "active")
                            .map(m => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.firstName ? `${m.firstName} ${m.lastName}` : m.email}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowOffboardDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={offboardMutation.isPending || (offboardRequiresConfirmation && offboardCases.some(c => !reassignments[c.id]))}
                  onClick={() => offboardMutation.mutate(
                    offboardRequiresConfirmation
                      ? Object.fromEntries(Object.entries(reassignments).map(([k, v]) => [k, v]))
                      : {}
                  )}
                  data-testid={`button-confirm-offboard-${member.id}`}
                >
                  {offboardMutation.isPending ? "Removing..." : offboardRequiresConfirmation ? "Confirm & Remove" : "Remove Member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function InviteDialog({ firmId }: { firmId: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", suggestedRole: "", authProvider: "google" },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: z.infer<typeof inviteSchema>) =>
      apiRequest("POST", "/api/team/invite", {
        email: data.email,
        suggestedRole: data.suggestedRole || null,
        authProvider: data.authProvider,
      }),
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "An invitation email has been sent to the recipient." });
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/team/invitations"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send invitation", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-invite-member">
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to a new team member. They will receive a link to join your firm.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => inviteMutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="colleague@firm.co.uk"
                      {...field}
                      data-testid="input-invite-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="suggestedRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggested Role (optional)</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-invite-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRIMARY_ROLES.map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sign-in method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-invite-auth-provider">
                        <SelectValue placeholder="Select sign-in method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="microsoft">Microsoft</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending} data-testid="button-send-invite">
                {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function FirmSettingsCard({ firm }: { firm: Firm }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const form = useForm<z.infer<typeof firmSchema>>({
    resolver: zodResolver(firmSchema),
    defaultValues: {
      name: firm.name,
      sraNumber: firm.sraNumber ?? "",
      addressLine1: firm.addressLine1 ?? "",
      addressLine2: firm.addressLine2 ?? "",
      city: firm.city ?? "",
      postcode: firm.postcode ?? "",
      phone: firm.phone ?? "",
      email: firm.email ?? "",
      website: firm.website ?? "",
    },
  });

  const updateFirmMutation = useMutation({
    mutationFn: (data: z.infer<typeof firmSchema>) => apiRequest("PATCH", "/api/firm", {
      ...data,
      sraNumber: data.sraNumber || null,
      addressLine1: data.addressLine1 || null,
      addressLine2: data.addressLine2 || null,
      city: data.city || null,
      postcode: data.postcode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
    }),
    onSuccess: () => {
      toast({ title: "Firm details updated", description: "Your firm profile has been saved." });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/firm"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update firm", description: err.message, variant: "destructive" });
    },
  });

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {firm.name}
            </CardTitle>
            {firm.sraNumber && (
              <CardDescription>SRA Number: {firm.sraNumber}</CardDescription>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} data-testid="button-edit-firm">
            Edit Details
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(firm.addressLine1 || firm.city || firm.postcode) && (
            <p className="text-muted-foreground">
              {[firm.addressLine1, firm.addressLine2, firm.city, firm.postcode].filter(Boolean).join(", ")}
            </p>
          )}
          {firm.phone && <p className="text-muted-foreground">{firm.phone}</p>}
          {firm.email && <p className="text-muted-foreground">{firm.email}</p>}
          {firm.website && <p className="text-muted-foreground">{firm.website}</p>}
          {!firm.addressLine1 && !firm.phone && !firm.email && (
            <p className="text-muted-foreground italic">No contact details on file. Click Edit Details to add them.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Firm Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(data => updateFirmMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Firm Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-firm-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sraNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>SRA Number</FormLabel>
                  <FormControl><Input placeholder="e.g. 123456" {...field} data-testid="input-sra-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="+44 20 7000 0000" {...field} data-testid="input-firm-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl><Input type="email" placeholder="info@yourfirm.co.uk" {...field} data-testid="input-firm-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl><Input placeholder="https://yourfirm.co.uk" {...field} data-testid="input-firm-website" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="addressLine1" render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl><Input {...field} data-testid="input-address-line-1" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="addressLine2" render={({ field }) => (
                <FormItem className="col-span-full">
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl><Input {...field} data-testid="input-address-line-2" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} data-testid="input-firm-city" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="postcode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode</FormLabel>
                  <FormControl><Input placeholder="EC1A 1BB" {...field} data-testid="input-firm-postcode" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" disabled={updateFirmMutation.isPending} data-testid="button-save-firm">
                {updateFirmMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function TeamManagement() {
  const { user, isFirmAdmin } = useAuth();

  const { data: firm, isLoading: firmLoading } = useQuery<Firm>({
    queryKey: ["/api/firm"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members"],
    enabled: !!firm,
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/team/invitations"],
    enabled: !!firm && isFirmAdmin,
  });

  const { data: formerMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team/members/former"],
    enabled: !!firm && isFirmAdmin,
  });

  const { data: roleLogs = [] } = useQuery<RoleLog[]>({
    queryKey: ["/api/team/role-logs"],
    enabled: !!firm && isFirmAdmin,
  });

  const { toast } = useToast();

  const cancelInvitationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/team/invitations/${id}/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/team/invitations"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to cancel invitation", description: err.message, variant: "destructive" });
    },
  });

  if (firmLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const activeInvitations = invitations.filter(inv => inv.status === "pending");
  const currentUserId = user?.id ?? "";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="heading-team-management">Team Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your team members, roles, and regulatory designations
          </p>
        </div>
        {isFirmAdmin && firm && <InviteDialog firmId={firm.id} />}
      </div>

      {firm && isFirmAdmin && <FirmSettingsCard firm={firm} />}

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-2" />
            Members ({members.length})
          </TabsTrigger>
          {isFirmAdmin && (
            <TabsTrigger value="invitations" data-testid="tab-invitations">
              <Mail className="h-4 w-4 mr-2" />
              Invitations
              {activeInvitations.length > 0 && (
                <Badge variant="secondary" className="ml-2">{activeInvitations.length}</Badge>
              )}
            </TabsTrigger>
          )}
          {isFirmAdmin && formerMembers.length > 0 && (
            <TabsTrigger value="former" data-testid="tab-former">
              <UserX className="h-4 w-4 mr-2" />
              Former Members
            </TabsTrigger>
          )}
          {isFirmAdmin && (
            <TabsTrigger value="audit" data-testid="tab-audit">
              <FileText className="h-4 w-4 mr-2" />
              Role Audit Log
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardContent className="pt-4">
              {membersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : members.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No team members yet.</p>
                  {isFirmAdmin && <p className="text-sm mt-1">Use the Invite Member button to add colleagues.</p>}
                </div>
              ) : (
                <div className="divide-y">
                  {members.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      currentUserId={currentUserId}
                      isFirmAdmin={isFirmAdmin}
                      firmId={firm?.id ?? ""}
                      allMembers={members}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isFirmAdmin && (
          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Invitations</CardTitle>
                <CardDescription>
                  Invitations expire after 7 days. Resend by cancelling and re-inviting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : activeInvitations.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No pending invitations.</p>
                ) : (
                  <div className="divide-y">
                    {activeInvitations.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between gap-4 py-3" data-testid={`card-invitation-${inv.id}`}>
                        <div>
                          <p className="text-sm font-medium" data-testid={`text-invite-email-${inv.id}`}>{inv.email}</p>
                          {inv.suggestedRole && (
                            <p className="text-xs text-muted-foreground">
                              {PRIMARY_ROLES.find(r => r.value === inv.suggestedRole)?.label ?? inv.suggestedRole}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Expires {format(new Date(inv.expiresAt), "d MMM yyyy")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelInvitationMutation.mutate(inv.id)}
                          disabled={cancelInvitationMutation.isPending}
                          data-testid={`button-cancel-invite-${inv.id}`}
                        >
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {invitations.filter(inv => inv.status !== "pending").length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <p className="text-xs text-muted-foreground font-medium mb-2">Past Invitations</p>
                    <div className="divide-y">
                      {invitations.filter(inv => inv.status !== "pending").map(inv => (
                        <div key={inv.id} className="flex items-center justify-between gap-4 py-2" data-testid={`card-past-invitation-${inv.id}`}>
                          <div>
                            <p className="text-sm text-muted-foreground">{inv.email}</p>
                          </div>
                          <Badge variant="outline" className="capitalize text-xs">{inv.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isFirmAdmin && formerMembers.length > 0 && (
          <TabsContent value="former">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Former Members</CardTitle>
                <CardDescription>
                  These team members have been removed from your firm. Their matters and documents remain in the system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {formerMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-4 py-3" data-testid={`card-former-${member.id}`}>
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={member.profileImageUrl ?? undefined} />
                        <AvatarFallback>
                          {getUserInitials(member.firstName, member.lastName, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {member.firstName && member.lastName
                            ? `${member.firstName} ${member.lastName}`
                            : member.email ?? "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getRoleLabel(member.primaryRole, member.customRoleLabel)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">Removed</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isFirmAdmin && (
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Change Audit Log</CardTitle>
                <CardDescription>
                  A record of all role and designation changes for your firm.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {roleLogs.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No role changes recorded yet.</p>
                ) : (
                  <div className="divide-y">
                    {roleLogs.map((log: RoleLog) => (
                      <div key={log.id} className="py-3 text-sm" data-testid={`card-role-log-${log.id}`}>
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="font-medium">
                            {log.user
                              ? (log.user.firstName ? `${log.user.firstName} ${log.user.lastName}` : log.user.email ?? log.userId)
                              : log.userId}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {log.createdAt ? format(new Date(log.createdAt), "d MMM yyyy HH:mm") : ""}
                          </span>
                        </div>
                        {log.previousRole !== log.newRole && (
                          <p className="text-muted-foreground mt-0.5">
                            Role: {PRIMARY_ROLES.find(r => r.value === log.previousRole)?.label ?? log.previousRole ?? "None"}
                            {" "}to{" "}
                            {PRIMARY_ROLES.find(r => r.value === log.newRole)?.label ?? log.newRole ?? "None"}
                          </p>
                        )}
                        {log.changedBy && (
                          <p className="text-xs text-muted-foreground">
                            Changed by: {log.changedBy.firstName ? `${log.changedBy.firstName} ${log.changedBy.lastName}` : log.changedBy.email ?? log.changedByUserId}
                          </p>
                        )}
                        {log.reason && <p className="text-muted-foreground text-xs">Reason: {log.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
