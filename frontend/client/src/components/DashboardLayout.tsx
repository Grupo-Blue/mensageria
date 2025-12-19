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
import { LayoutDashboard, LogOut, MessageSquare, Bot, Send, Settings as SettingsIcon, Code, Building2, Megaphone } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", color: "text-blue-600", bgColor: "bg-blue-50", hoverBg: "hover:bg-blue-50/50" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", color: "text-purple-600", bgColor: "bg-purple-50", hoverBg: "hover:bg-purple-50/50" },
  { icon: Building2, label: "WhatsApp Business", path: "/whatsapp-business", color: "text-emerald-600", bgColor: "bg-emerald-50", hoverBg: "hover:bg-emerald-50/50" },
  { icon: MessageSquare, label: "WhatsApp", path: "/whatsapp", color: "text-green-600", bgColor: "bg-green-50", hoverBg: "hover:bg-green-50/50" },
  { icon: Bot, label: "Telegram", path: "/telegram", color: "text-sky-600", bgColor: "bg-sky-50", hoverBg: "hover:bg-sky-50/50" },
  { icon: Send, label: "Enviar Mensagens", path: "/send", color: "text-pink-600", bgColor: "bg-pink-50", hoverBg: "hover:bg-pink-50/50" },
  { icon: Code, label: "API", path: "/api", color: "text-orange-600", bgColor: "bg-orange-50", hoverBg: "hover:bg-orange-50/50" },
  { icon: SettingsIcon, label: "Configurações", path: "/settings", color: "text-gray-600", bgColor: "bg-gray-50", hoverBg: "hover:bg-gray-50/50" },
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="relative">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-lg object-cover elevation-3"
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-medium tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">
                Please sign in to continue
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full"
          >
            Sign in
          </Button>
        </div>
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

  return (
    <>
      <Sidebar collapsible="none" className="bg-white border-r border-gray-200">
          <SidebarHeader className="h-16 px-4 flex items-center border-b border-gray-200">
            <div className="flex items-center gap-3 w-full">
              <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <img src={APP_LOGO} className="h-6 w-6 rounded object-cover" alt="Logo" />
              </div>
              <span className="font-bold text-lg text-gray-900">{APP_TITLE}</span>
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
                      className={`h-12 px-3 gap-3 rounded-lg font-semibold transition-colors ${
                        isActive 
                          ? `${item.bgColor} ${item.color}` 
                          : `text-gray-700 hover:bg-gray-100`
                      }`}
                    >
                      <item.icon className={`h-5 w-5 ${isActive ? item.color : "text-gray-500"}`} />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="px-3 py-4 border-t border-gray-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-2xl px-4 py-3 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus:ring-2 focus:ring-blue-400/30 shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-200 bg-white">
                  <Avatar className="h-12 w-12 flex-shrink-0 ring-2 ring-blue-100 shadow-md">
                    <AvatarFallback className="text-base font-bold bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-bold truncate leading-tight text-gray-900 mb-1">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-gray-600 truncate font-medium">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl shadow-xl border-gray-200 p-2">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 rounded-xl px-4 py-3 font-semibold transition-all duration-200 hover:shadow-sm"
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
          <div className="flex border-b border-slate-200/60 h-20 items-center justify-between bg-white/80 px-6 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="h-11 w-11 rounded-xl bg-white hover:bg-slate-50 shadow-md border border-slate-200 transition-all duration-200" />
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="tracking-tight text-slate-900 font-bold text-lg">
                    {activeMenuItem?.label ?? APP_TITLE}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {activeMenuItem ? 'Gerenciar' : 'Visão Geral'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </SidebarInset>
    </>
  );
}
