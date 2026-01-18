import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import ClientsPage from "@/pages/clients";
import AdCostsPage from "@/pages/ad-costs";
import InvoicesPage from "@/pages/invoices";
import InvoiceCreatePage from "@/pages/invoice-create";
import InvoiceEditPage from "@/pages/invoice-edit";
import InvoiceViewPage from "@/pages/invoice-view";
import PaymentsPage from "@/pages/payments";
import SettingsPage from "@/pages/settings";
import ReportsPage from "@/pages/reports"; // Import report page
import ExpensesPage from "@/pages/expenses";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={ClientsPage} />
      <Route path="/ad-costs" component={AdCostsPage} />
      <Route path="/invoices" component={InvoicesPage} />
      <Route path="/invoices/new" component={InvoiceCreatePage} />
      <Route path="/invoices/:id/edit" component={InvoiceEditPage} />
      <Route path="/invoices/:id" component={InvoiceViewPage} />
      <Route path="/payments" component={PaymentsPage} />
      <Route path="/accounting" component={ExpensesPage} />
      <Route path="/reports" component={ReportsPage} /> {/* Route added */}
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { setTimezone } from "@/lib/date";

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const { data: settings } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      const tz = settings.find(s => s.key === "timezone");
      if (tz) {
        setTimezone(tz.value);
      }
    }
  }, [settings]);

  return (
    <TooltipProvider>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background z-50">
              <SidebarTrigger />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto bg-background">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
