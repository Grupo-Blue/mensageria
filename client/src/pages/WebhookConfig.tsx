import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, ExternalLink, TestTube } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";

export default function WebhookConfig() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [connectionName, setConnectionName] = useState("mensageria");
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const { data: config, isLoading: configLoading, refetch } = trpc.webhook.getConfig.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = trpc.webhook.getLogs.useQuery(
    { limit: 20 },
    { enabled: !!user, refetchInterval: 10000 }
  );

  const saveConfigMutation = trpc.webhook.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva com sucesso!");
      refetch();
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const testWebhookMutation = trpc.webhook.testWebhook.useMutation({
    onSuccess: (data) => {
      toast.success("Webhook testado com sucesso!");
      console.log("Resposta do webhook:", data.response);
      refetchLogs();
    },
    onError: (error) => {
      toast.error(`Erro ao testar webhook: ${error.message}`);
    },
  });

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl || "");
      setWebhookSecret(config.webhookSecret || "");
      setEnabled(config.enabled || false);
      setConnectionName(config.connectionName || "mensageria");
    }
  }, [config]);

  if (authLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Você precisa estar logado para acessar esta página.</p>
        <Button onClick={() => window.location.href = getLoginUrl()}>Fazer Login</Button>
      </div>
    );
  }

  const handleSave = () => {
    if (!webhookUrl || !webhookSecret || !connectionName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    saveConfigMutation.mutate({
      webhookUrl,
      webhookSecret,
      enabled,
      connectionName,
    });
  };

  const handleTest = async () => {
    if (!webhookUrl || !webhookSecret) {
      toast.error("Configure a URL e o Secret antes de testar");
      return;
    }

    setIsTesting(true);
    try {
      await testWebhookMutation.mutateAsync({ webhookUrl, webhookSecret });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setLocation("/configuracoes")} className="mb-4">
            ← Voltar para Configurações
          </Button>
          <h1 className="text-3xl font-bold">Webhook de Mensagens Recebidas</h1>
          <p className="text-muted-foreground mt-2">
            Configure um webhook externo para receber notificações de mensagens recebidas no WhatsApp
          </p>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Como funciona:</strong> Quando alguém enviar uma mensagem para o seu WhatsApp conectado,
            o sistema automaticamente encaminhará essa mensagem para o webhook configurado abaixo.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Configuração do Webhook</CardTitle>
            <CardDescription>
              Insira a URL e o secret do seu webhook externo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">URL do Webhook *</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://seu-servidor.com/webhook/inbound"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Endpoint que receberá as mensagens via POST
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhookSecret">Secret / API Key *</Label>
              <div className="flex gap-2">
                <Input
                  id="webhookSecret"
                  type={showSecret ? "text" : "password"}
                  placeholder="seu-secret-seguro"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => setShowSecret(!showSecret)}
                  type="button"
                >
                  {showSecret ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Será enviado no header Authorization: Bearer {"{secret}"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="connectionName">Nome da Conexão WhatsApp *</Label>
              <Input
                id="connectionName"
                type="text"
                placeholder="mensageria"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Identificação da conexão WhatsApp que será monitorada
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Status do Webhook</Label>
                <p className="text-sm text-muted-foreground">
                  {enabled ? "Webhook ativo e encaminhando mensagens" : "Webhook desativado"}
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={saveConfigMutation.isPending}
                className="flex-1"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Configuração"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={isTesting || !webhookUrl || !webhookSecret}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4 mr-2" />
                    Testar Webhook
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Formato do Payload</CardTitle>
            <CardDescription>
              Estrutura JSON que será enviada para o seu webhook
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`POST ${webhookUrl || "https://seu-servidor.com/webhook/inbound"}
Content-Type: application/json
Authorization: Bearer ${webhookSecret || "<seu-secret>"}

{
  "from": "+5561998317422",
  "message_id": "msg-unique-id-12345",
  "timestamp": "2025-01-10T14:23:00Z",
  "text": "Oi, queria entender melhor sobre o investimento"
}`}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Últimas Mensagens Encaminhadas</CardTitle>
                <CardDescription>
                  Histórico das 20 mensagens mais recentes
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : logs && logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{log.fromNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.text}
                      </p>
                      {log.status === "error" && log.errorMessage && (
                        <p className="text-xs text-red-500 mt-1">
                          Erro: {log.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma mensagem encaminhada ainda</p>
                <p className="text-sm mt-2">
                  Configure o webhook e aguarde mensagens recebidas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
              <a
                href="https://mensageria.grupoblue.com.br/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Documentação da API REST
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              Para mais informações sobre como integrar com o sistema, consulte a documentação completa da API.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
