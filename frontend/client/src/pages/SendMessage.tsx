import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Send } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SendMessage() {
  const [selectedConnection, setSelectedConnection] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  const { data: whatsappConnections, refetch: refetchWhatsapp } = trpc.whatsapp.list.useQuery();

  const syncWhatsappMutation = trpc.whatsapp.sync.useMutation({
    onSuccess: () => {
      refetchWhatsapp();
    },
  });

  // Sincronizar conexões ao carregar a página
  useEffect(() => {
    syncWhatsappMutation.mutate();
  }, []);

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

  const activeWhatsappConnections = whatsappConnections?.filter(c => c.status === "connected") || [];

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

    const connection = whatsappConnections?.find(c => c.id.toString() === selectedConnection);
    if (!connection) return;

    sendWhatsappMutation.mutate({
      connectionId: connection.id,
      identification: connection.identification,
      recipient: recipient.trim(),
      message: message.trim(),
    });
  };

  const isPending = sendWhatsappMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enviar Mensagem</h1>
          <p className="text-gray-600 mt-2">
            Envie mensagens via WhatsApp
          </p>
        </div>

        {/* Send Form */}
        <Card>
          <CardHeader>
            <CardTitle>Enviar via WhatsApp</CardTitle>
            <CardDescription>
              Envie mensagens para números de WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Selection */}
            <div className="space-y-2">
              <Label htmlFor="connection">Conexão</Label>
              {activeWhatsappConnections.length > 0 ? (
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
              )}
            </div>

            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Número WhatsApp</Label>
              <Input
                id="recipient"
                placeholder="5511999999999"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Digite o número com código do país (ex: 5511999999999)
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
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Use o formato internacional: código do país + DDD + número</li>
              <li>• Exemplo: 5511999999999 (Brasil)</li>
              <li>• Não use espaços, traços ou parênteses</li>
              <li>• O número deve estar salvo no WhatsApp conectado</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
