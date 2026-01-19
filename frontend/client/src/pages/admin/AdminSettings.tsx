import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import {
  Settings,
  CreditCard,
  Mail,
  Shield,
  Save,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});

  const { data: systemSettings, isLoading, refetch } = trpc.admin.getSystemSettings.useQuery();

  const updateSettingMutation = trpc.admin.updateSystemSetting.useMutation({
    onSuccess: () => {
      toast.success("Configuração atualizada");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleMaintenanceMutation = trpc.admin.toggleMaintenanceMode.useMutation({
    onSuccess: (data) => {
      toast.success(
        data.maintenanceMode
          ? "Modo de manutenção ativado"
          : "Modo de manutenção desativado"
      );
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (systemSettings) {
      const settingsMap: Record<string, string> = {};
      systemSettings.forEach((s: any) => {
        settingsMap[s.key] = s.value || "";
      });
      setSettings(settingsMap);
    }
  }, [systemSettings]);

  const handleSave = (key: string) => {
    updateSettingMutation.mutate({ key, value: settings[key] || "" });
  };

  const isMaintenanceMode = settings.maintenance_mode === "true";

  return (
    <DashboardLayout
      title="Configurações do Sistema"
      description="Gerencie as configurações globais da plataforma"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Maintenance Mode Alert */}
        {isMaintenanceMode && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="flex items-center gap-4 py-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <div>
                <p className="font-medium">Modo de Manutenção Ativo</p>
                <p className="text-sm text-muted-foreground">
                  O sistema está em modo de manutenção. Novos usuários não podem
                  acessar.
                </p>
              </div>
              <Button
                variant="outline"
                className="ml-auto"
                onClick={() => toggleMaintenanceMutation.mutate()}
              >
                Desativar
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="stripe">
              <CreditCard className="h-4 w-4 mr-2" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="h-4 w-4 mr-2" />
              Email
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-2" />
              Segurança
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Aplicação</CardTitle>
                  <CardDescription>
                    Configurações básicas da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="app_name">Nome da Aplicação</Label>
                    <div className="flex gap-2">
                      <Input
                        id="app_name"
                        value={settings.app_name || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, app_name: e.target.value })
                        }
                        placeholder="Sistema de Mensageria"
                      />
                      <Button
                        onClick={() => handleSave("app_name")}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="support_email">Email de Suporte</Label>
                    <div className="flex gap-2">
                      <Input
                        id="support_email"
                        type="email"
                        value={settings.support_email || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            support_email: e.target.value,
                          })
                        }
                        placeholder="suporte@exemplo.com"
                      />
                      <Button
                        onClick={() => handleSave("support_email")}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="enterprise_contact_email">
                      Email de Contato Enterprise
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="enterprise_contact_email"
                        type="email"
                        value={settings.enterprise_contact_email || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            enterprise_contact_email: e.target.value,
                          })
                        }
                        placeholder="comercial@exemplo.com"
                      />
                      <Button
                        onClick={() => handleSave("enterprise_contact_email")}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Modo de Manutenção</Label>
                      <p className="text-sm text-muted-foreground">
                        Quando ativo, apenas administradores podem acessar o
                        sistema
                      </p>
                    </div>
                    <Switch
                      checked={isMaintenanceMode}
                      onCheckedChange={() => toggleMaintenanceMutation.mutate()}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Trial</CardTitle>
                  <CardDescription>
                    Período de teste para novos usuários
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="trial_days">Dias de Trial</Label>
                    <div className="flex gap-2">
                      <Input
                        id="trial_days"
                        type="number"
                        value={settings.trial_days || "7"}
                        onChange={(e) =>
                          setSettings({ ...settings, trial_days: e.target.value })
                        }
                        min="0"
                        max="30"
                      />
                      <Button
                        onClick={() => handleSave("trial_days")}
                        disabled={updateSettingMutation.isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Número de dias de período de teste para novos usuários
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Stripe Settings */}
          <TabsContent value="stripe">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Stripe</CardTitle>
                <CardDescription>
                  Integração com o gateway de pagamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        process.env.STRIPE_SECRET_KEY
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">Status da Conexão</p>
                      <p className="text-sm text-muted-foreground">
                        {process.env.STRIPE_SECRET_KEY
                          ? "Conectado ao Stripe"
                          : "Stripe não configurado"}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a
                      href="https://dashboard.stripe.com"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Dashboard Stripe
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    As chaves do Stripe são configuradas via variáveis de ambiente:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm font-mono">
                    <li>STRIPE_SECRET_KEY</li>
                    <li>STRIPE_PUBLISHABLE_KEY</li>
                    <li>STRIPE_WEBHOOK_SECRET</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Webhook URL</h4>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/stripe/webhook`}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/api/stripe/webhook`
                        );
                        toast.success("URL copiada!");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Configure esta URL no painel do Stripe para receber eventos
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Email</CardTitle>
                <CardDescription>
                  Servidor SMTP para envio de emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">
                    As configurações de email são definidas via variáveis de
                    ambiente:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm font-mono">
                    <li>SMTP_HOST</li>
                    <li>SMTP_PORT</li>
                    <li>SMTP_USER</li>
                    <li>SMTP_PASS</li>
                    <li>SMTP_FROM_NAME</li>
                    <li>SMTP_FROM_EMAIL</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Testar Conexão</p>
                    <p className="text-sm text-muted-foreground">
                      Envie um email de teste para verificar a configuração
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Teste
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Segurança</CardTitle>
                <CardDescription>
                  Opções de segurança e autenticação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="max_login_attempts">
                    Máximo de Tentativas de Login
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="max_login_attempts"
                      type="number"
                      value={settings.max_login_attempts || "5"}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          max_login_attempts: e.target.value,
                        })
                      }
                      min="1"
                      max="10"
                    />
                    <Button
                      onClick={() => handleSave("max_login_attempts")}
                      disabled={updateSettingMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Número de tentativas antes de bloquear temporariamente
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="session_timeout">
                    Timeout da Sessão (minutos)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="session_timeout"
                      type="number"
                      value={settings.session_timeout_minutes || "1440"}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          session_timeout_minutes: e.target.value,
                        })
                      }
                      min="60"
                      max="43200"
                    />
                    <Button
                      onClick={() => handleSave("session_timeout_minutes")}
                      disabled={updateSettingMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Tempo de inatividade antes de expirar a sessão (padrão: 24
                    horas)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
