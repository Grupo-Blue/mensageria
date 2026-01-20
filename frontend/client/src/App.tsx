import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import WhatsApp from "./pages/WhatsApp";
import WhatsAppBusiness from "./pages/WhatsAppBusiness";
import Telegram from "./pages/Telegram";
import SendMessage from "./pages/SendMessage";
import Settings from "./pages/Settings";
import API from "./pages/API";
import WebhookConfig from "./pages/WebhookConfig";
import ConnectionSettings from "./pages/ConnectionSettings";
import Campaigns from "./pages/Campaigns";
import CampaignNew from "./pages/CampaignNew";
import CampaignDetail from "./pages/CampaignDetail";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminErrors from "./pages/admin/AdminErrors";
import AdminSettings from "./pages/admin/AdminSettings";
// Public pages
import Landing from "./pages/Landing";
import Billing from "./pages/Billing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      {/* Public pages */}
      <Route path={"/"} component={Landing} />
      <Route path={"/terms"} component={Terms} />
      <Route path={"/privacy"} component={Privacy} />

      {/* App pages (authenticated) */}
      <Route path={"/dashboard"} component={Home} />
      <Route path={"/whatsapp"} component={WhatsApp} />
      <Route path={"/whatsapp-business"} component={WhatsAppBusiness} />
      <Route path={"/telegram"} component={Telegram} />
      <Route path={"/send"} component={SendMessage} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/api"} component={API} />
      <Route path={"/webhook"} component={WebhookConfig} />
      <Route path={"/connections"} component={ConnectionSettings} />
      <Route path={"/campaigns/new"} component={CampaignNew} />
      <Route path={"/campaigns/:id"} component={CampaignDetail} />
      <Route path={"/campaigns"} component={Campaigns} />
      <Route path={"/billing"} component={Billing} />

      {/* Admin pages */}
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/users"} component={AdminUsers} />
      <Route path={"/admin/subscriptions"} component={AdminSubscriptions} />
      <Route path={"/admin/connections"} component={AdminDashboard} />
      <Route path={"/admin/errors"} component={AdminErrors} />
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/plans"} component={AdminSettings} />
      <Route path={"/admin/logs"} component={AdminDashboard} />

      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
