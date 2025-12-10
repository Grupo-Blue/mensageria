import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Send } from "lucide-react";
import { toast } from "sonner";

export default function API() {
  const [testConnectionName, setTestConnectionName] = useState("mensageria");
  const [testTo, setTestTo] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testApiKey, setTestApiKey] = useState("test-api-key-123");
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);

  const apiEndpoint = "https://mensageria.grupoblue.com.br/api/send-message";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const testApi = async () => {
    if (!testTo || !testMessage) {
      toast.error("Preencha todos os campos");
      return;
    }

    setTesting(true);
    setTestResult("");

    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": testApiKey,
        },
        body: JSON.stringify({
          connectionName: testConnectionName,
          to: testTo,
          message: testMessage,
        }),
      });

      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));

      if (response.ok) {
        toast.success("Mensagem enviada com sucesso!");
      } else {
        toast.error(`Erro: ${data.error}`);
      }
    } catch (error: any) {
      setTestResult(`Erro: ${error.message}`);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setTesting(false);
    }
  };

  const curlExample = `curl -X POST ${apiEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${testApiKey}" \\
  -d '{
    "connectionName": "${testConnectionName}",
    "to": "5561986266334",
    "message": "Olá! Mensagem enviada via API"
  }'`;

  const javascriptExample = `const response = await fetch('${apiEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${testApiKey}'
  },
  body: JSON.stringify({
    connectionName: '${testConnectionName}',
    to: '5561986266334',
    message: 'Olá! Mensagem enviada via API'
  })
});

const data = await response.json();
console.log(data);`;

  const pythonExample = `import requests

url = '${apiEndpoint}'
headers = {
    'Content-Type': 'application/json',
    'X-API-Key': '${testApiKey}'
}
data = {
    'connectionName': '${testConnectionName}',
    'to': '5561986266334',
    'message': 'Olá! Mensagem enviada via API'
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">API REST</h1>
          <p className="text-muted-foreground">
            Integre o envio de mensagens WhatsApp com seus sistemas
          </p>
        </div>

        {/* Endpoint */}
        <Card>
          <CardHeader>
            <CardTitle>Endpoint</CardTitle>
            <CardDescription>URL base da API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-4 py-2 rounded text-sm">
                POST {apiEndpoint}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(apiEndpoint)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Autenticação */}
        <Card>
          <CardHeader>
            <CardTitle>Autenticação</CardTitle>
            <CardDescription>Envie sua API Key no header</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Todas as requisições devem incluir o header:
              </p>
              <code className="block bg-muted px-4 py-2 rounded text-sm">
                X-API-Key: {testApiKey}
              </code>
            </div>
          </CardContent>
        </Card>

        {/* Parâmetros */}
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros</CardTitle>
            <CardDescription>Corpo da requisição (JSON)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium">connectionName</p>
                <p className="text-sm text-muted-foreground">
                  Nome da conexão WhatsApp (ex: "mensageria")
                </p>
              </div>
              <div>
                <p className="font-medium">to</p>
                <p className="text-sm text-muted-foreground">
                  Número com DDI, apenas dígitos (ex: "5561986266334")
                </p>
              </div>
              <div>
                <p className="font-medium">message</p>
                <p className="text-sm text-muted-foreground">
                  Texto da mensagem
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exemplos de Código */}
        <Card>
          <CardHeader>
            <CardTitle>Exemplos de Código</CardTitle>
            <CardDescription>Integre em diferentes linguagens</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="space-y-2">
                <div className="relative">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    <code>{curlExample}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(curlExample)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="javascript" className="space-y-2">
                <div className="relative">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    <code>{javascriptExample}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(javascriptExample)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="python" className="space-y-2">
                <div className="relative">
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    <code>{pythonExample}</code>
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(pythonExample)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Testador Interativo */}
        <Card>
          <CardHeader>
            <CardTitle>Testar API</CardTitle>
            <CardDescription>Envie uma mensagem de teste</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-api-key">API Key</Label>
                <Input
                  id="test-api-key"
                  value={testApiKey}
                  onChange={(e) => setTestApiKey(e.target.value)}
                  placeholder="test-api-key-123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-connection">Conexão</Label>
                <Input
                  id="test-connection"
                  value={testConnectionName}
                  onChange={(e) => setTestConnectionName(e.target.value)}
                  placeholder="mensageria"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-to">Número (com DDI)</Label>
                <Input
                  id="test-to"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="5561986266334"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="test-message">Mensagem</Label>
                <Textarea
                  id="test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Digite sua mensagem de teste..."
                  rows={3}
                />
              </div>

              <Button onClick={testApi} disabled={testing}>
                <Send className="mr-2 h-4 w-4" />
                {testing ? "Enviando..." : "Enviar Teste"}
              </Button>

              {testResult && (
                <div className="space-y-2">
                  <Label>Resposta da API</Label>
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    <code>{testResult}</code>
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Respostas */}
        <Card>
          <CardHeader>
            <CardTitle>Respostas</CardTitle>
            <CardDescription>Formato das respostas da API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium mb-2">Sucesso (200)</p>
              <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                <code>{`{
  "success": true,
  "message": "Mensagem enviada",
  "data": {
    "to": "5561986266334@s.whatsapp.net",
    "sentAt": "2025-11-18T10:30:00.000Z"
  }
}`}</code>
              </pre>
            </div>

            <div>
              <p className="font-medium mb-2">Erro (400/403/404/500)</p>
              <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                <code>{`{
  "success": false,
  "error": "Descrição do erro"
}`}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
