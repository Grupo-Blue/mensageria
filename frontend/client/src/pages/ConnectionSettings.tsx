import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Key,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Webhook,
  Shield,
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ConnectionConfig {
  id: number;
  identification: string;
  apiKey: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  status: string;
  phoneNumber?: string | null;
}

export default function ConnectionSettings() {
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<number | null>(null);
  const [isWebhookDialogOpen, setIsWebhookDialogOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();

  const generateApiKeyMutation = trpc.whatsapp.generateApiKey.useMutation({
    onSuccess: (data) => {
      toast.success("Nova API Key gerada com sucesso!");
      utils.whatsapp.list.invalidate();
      if (data.apiKey) {
        copyToClipboard(data.apiKey, "API Key copiada!");
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateWebhookMutation = trpc.whatsapp.updateWebhook.useMutation({
    onSuccess: () => {
      toast.success("Webhook configurado com sucesso!");
      utils.whatsapp.list.invalidate();
      setIsWebhookDialogOpen(false);
      setSelectedConnection(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyToClipboard = async (text: string, message: string = "Copiado!") => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast.success(message);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateApiKey = (connectionId: number) => {
    generateApiKeyMutation.mutate({ connectionId });
  };

  const handleOpenWebhookDialog = (connection: ConnectionConfig) => {
    setSelectedConnection(connection);
    setWebhookUrl(connection.webhookUrl || "");
    setWebhookSecret(connection.webhookSecret || "");
    setIsWebhookDialogOpen(true);
  };

  const handleSaveWebhook = () => {
    if (!selectedConnection) return;

    updateWebhookMutation.mutate({
      connectionId: selectedConnection.id,
      webhookUrl: webhookUrl || undefined,
      webhookSecret: webhookSecret || undefined,
    });
  };

  const generateRandomSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setWebhookSecret(secret);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API & Webhooks</h1>
          <p className="text-gray-600 mt-2">
            Gerencie API Keys e configure webhooks para cada conexão WhatsApp
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Cada conexão WhatsApp pode ter sua própria API Key e Webhook, permitindo isolamento 
            completo entre diferentes clientes (multi-tenant).
          </AlertDescription>
        </Alert>

        {/* Connections List */}
        {!connections || connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma conexão encontrada</h3>
              <p className="text-gray-500 mt-2">
                Crie uma conexão WhatsApp primeiro para gerenciar API Keys e Webhooks
              </p>
              <Button className="mt-4" asChild>
                <a href="/whatsapp">Ir para WhatsApp</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {connections.map((connection: ConnectionConfig) => (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {connection.identification}
                        <Badge variant={connection.status === "connected" ? "default" : "secondary"}>
                          {connection.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {connection.phoneNumber || "Número não registrado"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* API Key Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-blue-600" />
                      <Label className="font-medium">API Key</Label>
                    </div>
                    
                    {connection.apiKey ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-gray-100 px-3 py-2 rounded-md text-sm font-mono">
                          {showApiKey === connection.id ? connection.apiKey : maskApiKey(connection.apiKey)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowApiKey(showApiKey === connection.id ? null : connection.id)}
                        >
                          {showApiKey === connection.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(connection.apiKey!, "API Key copiada!")}
                        >
                          {copiedKey === connection.apiKey ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateApiKey(connection.id)}
                          disabled={generateApiKeyMutation.isPending}
                        >
                          {generateApiKeyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          <span className="ml-1">Regenerar</span>
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Nenhuma API Key gerada</span>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleGenerateApiKey(connection.id)}
                          disabled={generateApiKeyMutation.isPending}
                        >
                          {generateApiKeyMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Key className="w-4 h-4 mr-1" />
                          )}
                          Gerar API Key
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Webhook Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-purple-600" />
                      <Label className="font-medium">Webhook</Label>
                    </div>
                    
                    {connection.webhookUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 bg-gray-100 px-3 py-2 rounded-md text-sm truncate">
                            {connection.webhookUrl}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(connection.webhookUrl!, "URL copiada!")}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenWebhookDialog(connection)}
                          >
                            Editar
                          </Button>
                        </div>
                        {connection.webhookSecret && (
                          <p className="text-xs text-gray-500">
                            ✓ Secret configurado
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Nenhum webhook configurado</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenWebhookDialog(connection)}
                        >
                          <Webhook className="w-4 h-4 mr-1" />
                          Configurar
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Usage Example */}
                  {connection.apiKey && (
                    <div className="pt-4 border-t">
                      <Label className="text-sm font-medium text-gray-700">Exemplo de uso:</Label>
                      <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
{`curl -X POST ${window.location.origin.replace(':3001', ':5600')}/connections/${connection.identification}/send \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${maskApiKey(connection.apiKey)}" \\
  -d '{"phone": "5511999999999", "message": "Olá!"}'`}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Webhook Dialog */}
        <Dialog open={isWebhookDialogOpen} onOpenChange={setIsWebhookDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar Webhook</DialogTitle>
              <DialogDescription>
                Configure a URL e o secret para receber mensagens do WhatsApp
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">URL do Webhook</Label>
                <Input
                  id="webhookUrl"
                  placeholder="https://seu-servidor.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Mensagens recebidas serão enviadas via POST para esta URL
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhookSecret">Secret (para validação HMAC)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhookSecret"
                    placeholder="seu-secret-aqui"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                  />
                  <Button variant="outline" onClick={generateRandomSecret}>
                    Gerar
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  O secret será enviado no header Authorization e usado para gerar a assinatura HMAC
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsWebhookDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveWebhook} disabled={updateWebhookMutation.isPending}>
                {updateWebhookMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Documentation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Documentação da API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Headers de Autenticação</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><code className="bg-gray-100 px-1">x-api-key</code> - API Key da conexão (multi-tenant)</li>
                <li><code className="bg-gray-100 px-1">x-auth-api</code> - Token global (legacy)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Headers do Webhook</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li><code className="bg-gray-100 px-1">Authorization</code> - Bearer {"{webhook_secret}"}</li>
                <li><code className="bg-gray-100 px-1">X-Webhook-Signature</code> - HMAC SHA256 do payload</li>
                <li><code className="bg-gray-100 px-1">X-Connection-Name</code> - Nome da conexão</li>
              </ul>
            </div>
            <Button variant="link" className="p-0" asChild>
              <a href="/api">Ver documentação completa →</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}







