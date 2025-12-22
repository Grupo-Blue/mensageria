import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  FileJson,
  Download,
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
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [configConnection, setConfigConnection] = useState<ConnectionConfig | null>(null);

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

  const handleOpenConfigDialog = (connection: ConnectionConfig) => {
    setConfigConnection(connection);
    setIsConfigDialogOpen(true);
  };

  const generateFullConfig = (connection: ConnectionConfig) => {
    const baseUrl = window.location.origin;
    return {
      connection: {
        name: connection.identification,
        status: connection.status,
        phoneNumber: connection.phoneNumber || "Não configurado"
      },
      api: {
        endpoint: `${baseUrl}/api/whatsapp/send-message`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": connection.apiKey || "NÃO CONFIGURADA - Gere uma API Key primeiro"
        }
      },
      webhook: {
        url: connection.webhookUrl || "NÃO CONFIGURADO",
        secret: connection.webhookSecret ? "••••••••" : "NÃO CONFIGURADO",
        headers_received: {
          "Authorization": "Bearer {webhook_secret}",
          "X-Webhook-Signature": "HMAC SHA256 do payload",
          "X-Connection-Name": connection.identification
        }
      },
      examples: {
        send_message: {
          curl: `curl -X POST "${baseUrl}/api/whatsapp/send-message" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${connection.apiKey || 'SUA_API_KEY'}" \\
  -d '{
    "connectionName": "${connection.identification}",
    "to": "5511999999999",
    "message": "Olá! Mensagem enviada via API"
  }'`,
          javascript: `const response = await fetch('${baseUrl}/api/whatsapp/send-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${connection.apiKey || 'SUA_API_KEY'}'
  },
  body: JSON.stringify({
    connectionName: '${connection.identification}',
    to: '5511999999999',
    message: 'Olá! Mensagem enviada via API'
  })
});

const data = await response.json();
console.log(data);`,
          python: `import requests

response = requests.post(
    '${baseUrl}/api/whatsapp/send-message',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': '${connection.apiKey || 'SUA_API_KEY'}'
    },
    json={
        'connectionName': '${connection.identification}',
        'to': '5511999999999',
        'message': 'Olá! Mensagem enviada via API'
    }
)

print(response.json())`,
          php: `<?php
$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL => '${baseUrl}/api/whatsapp/send-message',
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-API-Key: ${connection.apiKey || 'SUA_API_KEY'}'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'connectionName' => '${connection.identification}',
        'to' => '5511999999999',
        'message' => 'Olá! Mensagem enviada via API'
    ])
]);

$response = curl_exec($ch);
curl_close($ch);

print_r(json_decode($response, true));`
        },
        webhook_payload: {
          event: "message",
          from: "5511999999999",
          to: connection.phoneNumber || "SEU_NUMERO",
          message: "Mensagem recebida do cliente",
          timestamp: new Date().toISOString(),
          connection: connection.identification,
          messageId: "ABC123..."
        }
      }
    };
  };

  const copyConfigAsJson = (connection: ConnectionConfig) => {
    const config = generateFullConfig(connection);
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    toast.success("Configuração JSON copiada!");
  };

  const downloadConfig = (connection: ConnectionConfig) => {
    const config = generateFullConfig(connection);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config-${connection.identification}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo de configuração baixado!");
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

                  {/* Full Configuration Button */}
                  {connection.apiKey && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Configuração Completa</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyConfigAsJson(connection)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copiar JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadConfig(connection)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Baixar
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenConfigDialog(connection)}
                          >
                            <FileJson className="w-4 h-4 mr-1" />
                            Ver Exemplos
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Copie a configuração completa com API Key, endpoints e exemplos de código
                      </p>
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

        {/* Full Configuration Dialog */}
        <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileJson className="w-5 h-5" />
                Configuração Completa - {configConnection?.identification}
              </DialogTitle>
              <DialogDescription>
                Copie os exemplos de código para integrar com sua aplicação
              </DialogDescription>
            </DialogHeader>
            
            {configConnection && (
              <div className="space-y-4 py-4">
                {/* Connection Info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <Label className="text-xs text-gray-500">Conexão</Label>
                    <p className="font-medium">{configConnection.identification}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <Badge variant={configConnection.status === "connected" ? "default" : "secondary"}>
                      {configConnection.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Telefone</Label>
                    <p className="font-medium">{configConnection.phoneNumber || "Não registrado"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">API Key</Label>
                    <p className="font-mono text-sm">{configConnection.apiKey ? maskApiKey(configConnection.apiKey) : "Não gerada"}</p>
                  </div>
                </div>

                {/* API Endpoint */}
                <div className="space-y-2">
                  <Label className="font-medium">Endpoint da API</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-md text-sm">
                      POST {window.location.origin}/api/whatsapp/send-message
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/send-message`);
                        toast.success("URL copiada!");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Code Examples */}
                <div className="space-y-2">
                  <Label className="font-medium">Exemplos de Código</Label>
                  <Tabs defaultValue="curl" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="curl">cURL</TabsTrigger>
                      <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                      <TabsTrigger value="python">Python</TabsTrigger>
                      <TabsTrigger value="php">PHP</TabsTrigger>
                    </TabsList>

                    <TabsContent value="curl" className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          const config = generateFullConfig(configConnection);
                          navigator.clipboard.writeText(config.examples.send_message.curl);
                          toast.success("cURL copiado!");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                        {generateFullConfig(configConnection).examples.send_message.curl}
                      </pre>
                    </TabsContent>

                    <TabsContent value="javascript" className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          const config = generateFullConfig(configConnection);
                          navigator.clipboard.writeText(config.examples.send_message.javascript);
                          toast.success("JavaScript copiado!");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                        {generateFullConfig(configConnection).examples.send_message.javascript}
                      </pre>
                    </TabsContent>

                    <TabsContent value="python" className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          const config = generateFullConfig(configConnection);
                          navigator.clipboard.writeText(config.examples.send_message.python);
                          toast.success("Python copiado!");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                        {generateFullConfig(configConnection).examples.send_message.python}
                      </pre>
                    </TabsContent>

                    <TabsContent value="php" className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => {
                          const config = generateFullConfig(configConnection);
                          navigator.clipboard.writeText(config.examples.send_message.php);
                          toast.success("PHP copiado!");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                        {generateFullConfig(configConnection).examples.send_message.php}
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Webhook Info */}
                {configConnection.webhookUrl && (
                  <div className="space-y-2">
                    <Label className="font-medium">Webhook Configurado</Label>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                      <div>
                        <Label className="text-xs text-gray-500">URL</Label>
                        <p className="font-mono text-sm break-all">{configConnection.webhookUrl}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Exemplo de Payload Recebido</Label>
                        <pre className="mt-1 bg-gray-900 text-gray-100 p-3 rounded-md text-xs overflow-x-auto">
{JSON.stringify(generateFullConfig(configConnection).examples.webhook_payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* JSON Config */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Configuração JSON Completa</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyConfigAsJson(configConnection)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadConfig(configConnection)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Baixar
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    readOnly
                    className="font-mono text-xs h-48"
                    value={JSON.stringify(generateFullConfig(configConnection), null, 2)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
                Fechar
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







