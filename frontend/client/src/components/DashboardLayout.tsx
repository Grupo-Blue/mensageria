import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, MessageSquare, Bot, Send, Settings as SettingsIcon, Code, Building2, Megaphone, Moon, Sun } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950/30", hoverBg: "hover:bg-blue-50/50 dark:hover:bg-blue-950/20" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950/30", hoverBg: "hover:bg-purple-50/50 dark:hover:bg-purple-950/20" },
  { icon: Building2, label: "WhatsApp Business", path: "/whatsapp-business", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", hoverBg: "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20" },
  { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp", color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950/30", hoverBg: "hover:bg-green-50/50 dark:hover:bg-green-950/20" },
  { icon: Bot, label: "Telegram", path: "/telegram", color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950/30", hoverBg: "hover:bg-sky-50/50 dark:hover:bg-sky-950/20" },
  { icon: Send, label: "Enviar Mensagens", path: "/send", color: "text-pink-600", bgColor: "bg-pink-50 dark:bg-pink-950/30", hoverBg: "hover:bg-pink-50/50 dark:hover:bg-pink-950/20" },
  { icon: Code, label: "API", path: "/api", color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950/30", hoverBg: "hover:bg-orange-50/50 dark:hover:bg-orange-950/20" },
  { icon: SettingsIcon, label: "Configurações", path: "/settings", color: "text-gray-600", bgColor: "bg-gray-50 dark:bg-gray-800/30", hoverBg: "hover:bg-gray-50/50 dark:hover:bg-gray-800/20" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-8 p-8 max-w-md w-full"
        >
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              </div>
            </motion.div>
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {APP_TITLE}
              </h1>
              <p className="text-sm text-muted-foreground">
                Faça login para continuar
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
          >
            Entrar
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();

  return (
    <>
      <Sidebar collapsible="none" className="border-r border-border/50 bg-sidebar backdrop-blur-xl">
        <SidebarHeader className="h-16 px-4 flex items-center border-b border-border/50">
          <div className="flex items-center gap-3 w-full">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
              <img src={APP_LOGO} className="h-6 w-6 rounded object-cover" alt="Logo" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {APP_TITLE}
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4">
          <SidebarMenu className="space-y-1">
            {menuItems.map(item => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    className={`h-12 px-3 gap-3 rounded-xl font-semibold transition-all duration-200 ${
                      isActive 
                        ? `${item.bgColor} ${item.color} shadow-md` 
                        : `text-sidebar-foreground/70 hover:text-sidebar-foreground ${item.hoverBg}`
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? item.color : "text-sidebar-foreground/50"} transition-colors`} />
                    <span className="text-sm">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="px-3 py-4 border-t border-border/50 space-y-3">
          {/* Theme Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full justify-start gap-3 rounded-xl"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-sm">Modo Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-sm">Modo Escuro</span>
              </>
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-2xl px-4 py-3 hover:bg-sidebar-accent transition-all duration-200 w-full text-left group focus:outline-none focus:ring-2 focus:ring-ring shadow-sm hover:shadow-md border border-border/50 bg-sidebar">
                <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-primary/20 shadow-md">
                  <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate leading-tight text-sidebar-foreground">
                    {user?.name || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate font-medium">
                    {user?.email || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-border p-2">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30 rounded-xl px-4 py-3 font-semibold transition-all duration-200 hover:shadow-sm"
              >
                <LogOut className="mr-3 h-5 w-5" />
                <span className="text-sm">Sair da Conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/50 h-20 items-center justify-between bg-background/80 px-6 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-11 w-11 rounded-xl bg-sidebar hover:bg-sidebar-accent shadow-md border border-border/50 transition-all duration-200" />
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="tracking-tight text-foreground font-bold text-lg">
                    {activeMenuItem?.label ?? APP_TITLE}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {activeMenuItem ? 'Gerenciar' : 'Visão Geral'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 bg-gradient-to-br from-gray-50/50 via-background to-gray-50/50 dark:from-gray-900/50 dark:via-background dark:to-gray-900/50 min-h-screen">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
