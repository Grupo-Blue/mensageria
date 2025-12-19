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

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
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
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
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
