import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Loader2, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SendMessage() {
  const [platform, setPlatform] = useState<"whatsapp" | "telegram">("whatsapp");
  const [selectedConnection, setSelectedConnection] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  const { data: whatsappConnections } = trpc.whatsapp.list.useQuery();
  const { data: telegramConnections } = trpc.telegram.list.useQuery();

  const sendWhatsappMutation = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setRecipient("");
      setMessage("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const sendTelegramMutation = trpc.telegram.sendMessage.useMutation({
    onSuccess: () => {
      toast.success("Mensagem enviada com sucesso!");
      setRecipient("");
      setMessage("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const activeWhatsappConnections = whatsappConnections?.filter(c => c.status === "connected") || [];
  const activeTelegramConnections = telegramConnections?.filter(c => c.status === "connected") || [];

  const handleSend = () => {
    if (!selectedConnection) {
      toast.error("Selecione uma conexão");
      return;
    }
    if (!recipient.trim()) {
      toast.error("Digite o destinatário");
      return;
    }
    if (!message.trim()) {
      toast.error("Digite a mensagem");
      return;
    }

    if (platform === "whatsapp") {
      const connection = whatsappConnections?.find(c => c.id.toString() === selectedConnection);
      if (!connection) return;

      sendWhatsappMutation.mutate({
        connectionId: connection.id,
        identification: connection.identification,
        recipient: recipient.trim(),
        message: message.trim(),
      });
    } else {
      const connection = telegramConnections?.find(c => c.id.toString() === selectedConnection);
      if (!connection) return;

      sendTelegramMutation.mutate({
        connectionId: connection.id,
        botToken: connection.botToken,
        chatId: recipient.trim(),
        message: message.trim(),
      });
    }
  };

  const isPending = sendWhatsappMutation.isPending || sendTelegramMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enviar Mensagem</h1>
          <p className="text-gray-600 mt-2">
            Envie mensagens via WhatsApp ou Telegram
          </p>
        </div>

        {/* Platform Selection */}
        <div className="flex space-x-4">
          <Button
            variant={platform === "whatsapp" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setPlatform("whatsapp");
              setSelectedConnection("");
              setRecipient("");
            }}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
          <Button
            variant={platform === "telegram" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setPlatform("telegram");
              setSelectedConnection("");
              setRecipient("");
            }}
          >
            <Bot className="w-4 h-4 mr-2" />
            Telegram
          </Button>
        </div>

        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {platform === "whatsapp" ? "Enviar via WhatsApp" : "Enviar via Telegram"}
            </CardTitle>
            <CardDescription>
              {platform === "whatsapp"
                ? "Envie mensagens para números de WhatsApp"
                : "Envie mensagens para chats do Telegram"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Selection */}
            <div className="space-y-2">
              <Label htmlFor="connection">Conexão</Label>
              {platform === "whatsapp" ? (
                activeWhatsappConnections.length > 0 ? (
                  <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                    <SelectTrigger id="connection">
                      <SelectValue placeholder="Selecione uma conexão WhatsApp" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeWhatsappConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id.toString()}>
                          {conn.identification} {conn.phoneNumber && `(${conn.phoneNumber})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Nenhuma conexão WhatsApp ativa. Conecte um WhatsApp primeiro.
                    </p>
                  </div>
                )
              ) : (
                activeTelegramConnections.length > 0 ? (
                  <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                    <SelectTrigger id="connection">
                      <SelectValue placeholder="Selecione um bot Telegram" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTelegramConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id.toString()}>
                          @{conn.botUsername || "Bot"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Nenhum bot Telegram ativo. Conecte um bot primeiro.
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="recipient">
                {platform === "whatsapp" ? "Número WhatsApp" : "Chat ID"}
              </Label>
              <Input
                id="recipient"
                placeholder={
                  platform === "whatsapp"
                    ? "5511999999999"
                    : "123456789"
                }
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                {platform === "whatsapp"
                  ? "Digite o número com código do país (ex: 5511999999999)"
                  : "Digite o ID do chat ou usuário"}
              </p>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-gray-500">
                {message.length} caracteres
              </p>
            </div>

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={isPending || !selectedConnection}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensagem
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dicas</CardTitle>
          </CardHeader>
          <CardContent>
            {platform === "whatsapp" ? (
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Use o formato internacional: código do país + DDD + número</li>
                <li>• Exemplo: 5511999999999 (Brasil)</li>
                <li>• Não use espaços, traços ou parênteses</li>
                <li>• O número deve estar salvo no WhatsApp conectado</li>
              </ul>
            ) : (
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Para obter o Chat ID, use o bot @userinfobot</li>
                <li>• Para grupos, adicione o bot e use o comando /id</li>
                <li>• Chat IDs podem ser negativos para grupos</li>
                <li>• O bot deve ter permissão para enviar mensagens</li>
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
