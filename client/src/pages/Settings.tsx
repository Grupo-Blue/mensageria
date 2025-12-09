import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [resumeGroupId, setResumeGroupId] = useState("");
  const [resumeGroupIdToSend, setResumeGroupIdToSend] = useState("");
  const [resumeHourOfDay, setResumeHourOfDay] = useState("22");
  const [enableGroupResume, setEnableGroupResume] = useState(false);
  const [resumePrompt, setResumePrompt] = useState("");
  const [resumeConnectionId, setResumeConnectionId] = useState<number | undefined>();
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const { data: connections } = trpc.whatsapp.list.useQuery();
  const { data: groups } = trpc.whatsappGroups.list.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      utils.settings.get.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setGoogleApiKey(settings.googleApiKey || "");
      setResumeGroupId(settings.resumeGroupId || "");
      setResumeGroupIdToSend(settings.resumeGroupIdToSend || "");
      setResumeHourOfDay(settings.resumeHourOfDay?.toString() || "22");
      setEnableGroupResume(settings.enableGroupResume || false);
      setResumePrompt(settings.resumePrompt || "");
      setResumeConnectionId(settings.resumeConnectionId || undefined);
    }
  }, [settings]);

  const chatMutation = trpc.settings.analyzeMessages.useMutation({
    onSuccess: (data) => {
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      googleApiKey: googleApiKey.trim() || undefined,
      resumeGroupId: resumeGroupId.trim() || undefined,
      resumeGroupIdToSend: resumeGroupIdToSend.trim() || undefined,
      resumeHourOfDay: parseInt(resumeHourOfDay),
      enableGroupResume,
      resumePrompt: resumePrompt.trim() || undefined,
      resumeConnectionId,
    });
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    
    setChatHistory(prev => [...prev, { role: 'user', content: chatMessage }]);
    chatMutation.mutate({ 
      question: chatMessage,
      groupId: resumeGroupId,
      geminiApiKey: googleApiKey
    });
    setChatMessage("");
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

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
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-2">
            Configure as integrações e funcionalidades do sistema
          </p>
        </div>

        {/* Google API Key */}
        <Card>
          <CardHeader>
            <CardTitle>Google Gemini API</CardTitle>
            <CardDescription>
              Chave de API para usar o Google Gemini (IA) nos resumos de grupos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="googleApiKey">API Key</Label>
              <Input
                id="googleApiKey"
                type="password"
                placeholder="AIza..."
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Obtenha sua chave em{" "}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            {/* Prompt Customizado */}
            <div className="space-y-2">
              <Label htmlFor="resumePrompt">Prompt Customizado (Opcional)</Label>
              <textarea
                id="resumePrompt"
                className="w-full min-h-[120px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Personalize o prompt usado para gerar resumos. Deixe em branco para usar o padrão."
                value={resumePrompt}
                onChange={(e) => setResumePrompt(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Exemplo: "Crie um resumo executivo focando em decisões e ações..."
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Group Resume Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo Automático de Grupos</CardTitle>
            <CardDescription>
              Configure o resumo diário de mensagens de grupos WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableGroupResume">Ativar Resumo Automático</Label>
                <p className="text-sm text-gray-500">
                  Enviar resumo diário das mensagens do grupo
                </p>
              </div>
              <Switch
                id="enableGroupResume"
                checked={enableGroupResume}
                onCheckedChange={setEnableGroupResume}
              />
            </div>

            {enableGroupResume && (
              <>
                {/* Source Group */}
                <div className="space-y-2">
                  <Label htmlFor="resumeGroupId">Grupo de Origem</Label>
                  <Select value={resumeGroupId} onValueChange={setResumeGroupId}>
                    <SelectTrigger id="resumeGroupId">
                      <SelectValue placeholder="Selecione o grupo a monitorar" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups && groups.length > 0 ? (
                        groups.map((group) => {
                          const lastActivity = group.lastMessageAt 
                            ? new Date(group.lastMessageAt).toLocaleString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            : 'Sem atividade';
                          return (
                            <SelectItem key={group.groupId} value={group.groupId}>
                              <div className="flex flex-col">
                                <span>{group.groupName || group.groupId}</span>
                                <span className="text-xs text-gray-500">Última msg: {lastActivity}</span>
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhum grupo detectado ainda
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Grupo WhatsApp que será monitorado para resumos
                  </p>
                </div>

                {/* Destination Group */}
                <div className="space-y-2">
                  <Label htmlFor="resumeGroupIdToSend">Grupo de Destino</Label>
                  <Select value={resumeGroupIdToSend} onValueChange={setResumeGroupIdToSend}>
                    <SelectTrigger id="resumeGroupIdToSend">
                      <SelectValue placeholder="Selecione onde enviar o resumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups && groups.length > 0 ? (
                        groups.map((group) => {
                          const lastActivity = group.lastMessageAt 
                            ? new Date(group.lastMessageAt).toLocaleString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            : 'Sem atividade';
                          return (
                            <SelectItem key={group.groupId} value={group.groupId}>
                              <div className="flex flex-col">
                                <span>{group.groupName || group.groupId}</span>
                                <span className="text-xs text-gray-500">Última msg: {lastActivity}</span>
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="none" disabled>
                          Nenhum grupo detectado ainda
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Grupo onde o resumo será enviado (pode ser o mesmo)
                  </p>
                </div>

                {/* WhatsApp Connection */}
                <div className="space-y-2">
                  <Label htmlFor="resumeConnectionId">Conexão WhatsApp</Label>
                  <Select 
                    value={resumeConnectionId?.toString() || ""} 
                    onValueChange={(val) => setResumeConnectionId(val ? parseInt(val) : undefined)}
                  >
                    <SelectTrigger id="resumeConnectionId">
                      <SelectValue placeholder="Selecione uma conexão" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections?.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id.toString()}>
                          {conn.identification} {conn.phoneNumber ? `(${conn.phoneNumber})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Conexão WhatsApp que será usada para enviar o resumo
                  </p>
                </div>

                {/* Hour */}
                <div className="space-y-2">
                  <Label htmlFor="resumeHourOfDay">Horário do Resumo</Label>
                  <Select value={resumeHourOfDay} onValueChange={setResumeHourOfDay}>
                    <SelectTrigger id="resumeHourOfDay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {hours.map((hour) => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {hour.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Horário diário para enviar o resumo (horário do servidor)
                  </p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-blue-900">
                    Como obter o ID do grupo:
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Abra o grupo no WhatsApp Web</li>
                    <li>Copie o ID da URL (após /chat/)</li>
                    <li>Exemplo: 120363123456789012@g.us</li>
                  </ol>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Chat de Análise */}
        {enableGroupResume && googleApiKey && resumeGroupId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat de Análise de Mensagens
              </CardTitle>
              <CardDescription>
                Faça perguntas sobre as mensagens do grupo monitorado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Chat History */}
              <div className="border border-gray-200 rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-3">
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    Nenhuma conversa ainda. Faça uma pergunta sobre as mensagens do grupo!
                  </p>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-blue-100 ml-auto max-w-[80%]'
                          : 'bg-gray-100 mr-auto max-w-[80%]'
                      }`}
                    >
                      <p className="text-xs font-medium text-gray-600 mb-1">
                        {msg.role === 'user' ? 'Você' : 'Assistente'}
                      </p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Quais as principais dúvidas do grupo hoje?"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  disabled={chatMutation.isPending}
                />
                <Button
                  onClick={handleSendChat}
                  disabled={chatMutation.isPending || !chatMessage.trim()}
                  size="icon"
                >
                  {chatMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            size="lg"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
