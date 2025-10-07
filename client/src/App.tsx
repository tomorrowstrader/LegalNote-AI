import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import TopNavigation from "@/components/TopNavigation";
import ThemeToggle from "@/components/ThemeToggle";
import Dashboard from "@/pages/Dashboard";
import NewNote from "@/pages/NewNote";
import CaseDetail from "@/pages/CaseDetail";
import SavedCases from "@/pages/SavedCases";
import Settings from "@/pages/Settings";
import MyProfile from "@/pages/MyProfile";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/new-note" component={NewNote} />
      <Route path="/case/:id" component={CaseDetail} />
      <Route path="/cases" component={SavedCases} />
      <Route path="/settings" component={Settings} />
      <Route path="/profile" component={MyProfile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-background">
          <TopNavigation />
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
