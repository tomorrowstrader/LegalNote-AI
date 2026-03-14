import { useState } from "react";
import { ArrowLeft, User, Shield, Phone, Mail, MapPin, Building, Calendar, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Client, Case } from "@shared/schema";

export default function ClientProfile() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const clientId = params.id;
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["/api/clients", clientId],
  });

  const { data: clientCases = [], isLoading: casesLoading } = useQuery<Case[]>({
    queryKey: ["/api/clients", clientId, "cases"],
  });

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    companyName: "",
    amlRiskLevel: "",
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Client>) => {
      return await apiRequest("PATCH", `/api/clients/${clientId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setShowEditDialog(false);
      toast({
        title: "Client updated",
        description: "Client details have been saved.",
        duration: 4000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update client",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = () => {
    if (client) {
      setEditForm({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        companyName: client.companyName || "",
        amlRiskLevel: client.amlRiskLevel || "",
      });
    }
    setShowEditDialog(true);
  };

  const handleEditSave = () => {
    const updates: Partial<Client> = {
      name: editForm.name,
      email: editForm.email || null,
      phone: editForm.phone || null,
      address: editForm.address || null,
      companyName: editForm.companyName || null,
    };
    if (editForm.amlRiskLevel) {
      updates.amlRiskLevel = editForm.amlRiskLevel;
      updates.amlRiskLastReviewed = new Date();
    }
    updateMutation.mutate(updates);
  };

  const riskBadgeVariant = (level: string | null) => {
    if (level === "high") return "destructive";
    if (level === "medium") return "secondary";
    return "outline";
  };

  const statusBadgeVariant = (status: string) => {
    if (status === "completed") return "secondary";
    if (status === "review_required") return "outline";
    if (status === "processing") return "secondary";
    return "outline";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/clients")}
            className="mb-6 gap-2"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Clients
          </Button>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Client not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => setLocation("/clients")}
          className="mb-6 gap-2"
          data-testid="button-back-to-clients"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-client-name">
              {client.name}
            </h1>
            {client.companyName && (
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Building className="w-4 h-4" />
                {client.companyName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {client.amlRiskLevel && (
              <Badge variant={riskBadgeVariant(client.amlRiskLevel)} data-testid="badge-aml-risk">
                <Shield className="w-3 h-3 mr-1" />
                AML: {client.amlRiskLevel.toUpperCase()}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-2" data-testid="button-edit-client">
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-client-email">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-client-phone">{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span data-testid="text-client-address">{client.address}</span>
                </div>
              )}
              {client.dateOfBirth && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>DOB: {format(new Date(client.dateOfBirth), "dd MMM yyyy")}</span>
                </div>
              )}
              {!client.email && !client.phone && !client.address && (
                <p className="text-sm text-muted-foreground">No contact details on file</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                AML Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Risk Level:</span>
                {client.amlRiskLevel ? (
                  <Badge variant={riskBadgeVariant(client.amlRiskLevel)} data-testid="text-risk-level">
                    {client.amlRiskLevel.toUpperCase()}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Not assessed</span>
                )}
              </div>
              {client.amlRiskLastReviewed && (
                <div className="text-sm text-muted-foreground" data-testid="text-risk-reviewed">
                  Last reviewed: {format(new Date(client.amlRiskLastReviewed), "dd MMM yyyy")}
                </div>
              )}
              {client.clioClientId && (
                <div className="text-sm text-muted-foreground">
                  Clio ID: {client.clioClientId}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Matters ({clientCases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {casesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : clientCases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No matters linked to this client yet
              </p>
            ) : (
              <div className="space-y-2">
                {clientCases.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setLocation(`/case/${c.id}`)}
                    className="w-full text-left p-3 rounded-md hover-elevate flex items-center justify-between gap-4"
                    data-testid={`link-case-${c.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.matterReference && <span>{c.matterReference} &middot; </span>}
                        {format(new Date(c.createdAt), "dd MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.riskLevel && (
                        <Badge variant={riskBadgeVariant(c.riskLevel)} className="text-xs">
                          {c.riskLevel.toUpperCase()}
                        </Badge>
                      )}
                      <Badge variant={statusBadgeVariant(c.status)} className="text-xs" data-testid={`badge-status-${c.id}`}>
                        {c.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent data-testid="dialog-edit-client">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address}
                onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                data-testid="input-edit-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company Name</Label>
              <Input
                id="edit-company"
                value={editForm.companyName}
                onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                data-testid="input-edit-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-risk">AML Risk Level</Label>
              <Select
                value={editForm.amlRiskLevel}
                onValueChange={(val) => setEditForm(prev => ({ ...prev, amlRiskLevel: val }))}
              >
                <SelectTrigger data-testid="select-edit-risk">
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-edit-cancel">
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending || !editForm.name.trim()} data-testid="button-edit-save">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
