import { useState } from "react";
import { Plus, Users, Search, Shield, Building, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@shared/schema";

export default function Clients() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    amlRiskLevel: "",
  });

  const { data: allClients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Client>) => {
      return await apiRequest<Client>("POST", "/api/clients", data);
    },
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowNewDialog(false);
      setNewForm({ name: "", email: "", phone: "", companyName: "", amlRiskLevel: "" });
      toast({
        title: "Client created",
        description: `${client.name} has been added.`,
        duration: 4000,
      });
      setLocation(`/clients/${client.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create client",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ migrated: number }>("POST", "/api/clients/migrate", {});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Migration complete",
        description: `Created ${data.migrated} client records from existing cases.`,
        duration: 6000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Migration failed",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!newForm.name.trim()) return;
    const payload: Record<string, string | undefined> = {
      name: newForm.name.trim(),
    };
    if (newForm.email) payload.email = newForm.email;
    if (newForm.phone) payload.phone = newForm.phone;
    if (newForm.companyName) payload.companyName = newForm.companyName;
    if (newForm.amlRiskLevel) payload.amlRiskLevel = newForm.amlRiskLevel;
    createMutation.mutate(payload as Partial<Client>);
  };

  const filteredClients = searchQuery.trim()
    ? allClients.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.companyName && c.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : allClients;

  const riskBadgeVariant = (level: string | null) => {
    if (level === "high") return "destructive" as const;
    if (level === "medium") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your client registry and view linked matters
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => migrateMutation.mutate()} disabled={migrateMutation.isPending} data-testid="button-migrate-clients">
              {migrateMutation.isPending ? "Migrating..." : "Import from Cases"}
            </Button>
            <Button size="sm" onClick={() => setShowNewDialog(true)} className="gap-2" data-testid="button-new-client">
              <Plus className="w-4 h-4" />
              New Client
            </Button>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-clients"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : filteredClients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No clients match your search" : "No clients yet"}
              </p>
              {!searchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Create a new client or import existing ones from your cases
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => setLocation(`/clients/${client.id}`)}
                className="w-full text-left p-4 rounded-md border hover-elevate flex items-center justify-between gap-4"
                data-testid={`link-client-${client.id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" data-testid={`text-client-name-${client.id}`}>
                    {client.name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    {client.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {client.email}
                      </span>
                    )}
                    {client.companyName && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        {client.companyName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {client.amlRiskLevel && (
                    <Badge variant={riskBadgeVariant(client.amlRiskLevel)} className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      {client.amlRiskLevel.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent data-testid="dialog-new-client">
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name <span className="text-accent">*</span></Label>
              <Input
                id="new-name"
                value={newForm.name}
                onChange={(e) => setNewForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Mrs. Catherine Williams"
                data-testid="input-new-client-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm(prev => ({ ...prev, email: e.target.value }))}
                data-testid="input-new-client-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-phone">Phone</Label>
              <Input
                id="new-phone"
                value={newForm.phone}
                onChange={(e) => setNewForm(prev => ({ ...prev, phone: e.target.value }))}
                data-testid="input-new-client-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company">Company Name</Label>
              <Input
                id="new-company"
                value={newForm.companyName}
                onChange={(e) => setNewForm(prev => ({ ...prev, companyName: e.target.value }))}
                data-testid="input-new-client-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-risk">AML Risk Level</Label>
              <Select
                value={newForm.amlRiskLevel}
                onValueChange={(val) => setNewForm(prev => ({ ...prev, amlRiskLevel: val }))}
              >
                <SelectTrigger data-testid="select-new-client-risk">
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
            <Button variant="outline" onClick={() => setShowNewDialog(false)} data-testid="button-new-cancel">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending || !newForm.name.trim()} data-testid="button-new-save">
              {createMutation.isPending ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
