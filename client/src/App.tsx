import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/TopNavigation";
import Dashboard from "@/pages/Dashboard";
import NewNote from "@/pages/NewNote";
import CaseDetail from "@/pages/CaseDetail";
import SavedCases from "@/pages/SavedCases";
import Settings from "@/pages/Settings";
import MyProfile from "@/pages/MyProfile";
import AuditLogs from "@/pages/AuditLogs";
import AdminUsage from "@/pages/AdminUsage";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/new-note" component={NewNote} />
          <Route path="/case/:id" component={CaseDetail} />
          <Route path="/cases" component={SavedCases} />
          <Route path="/settings" component={Settings} />
          <Route path="/profile" component={MyProfile} />
          <Route path="/audit-logs" component={AuditLogs} />
          <Route path="/admin/usage" component={AdminUsage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {!isLoading && isAuthenticated && <TopNavigation />}
      <Router />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthenticatedApp />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
