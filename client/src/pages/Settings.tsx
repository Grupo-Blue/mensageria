import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Settings() {
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [resumeGroupId, setResumeGroupId] = useState("");
  const [resumeGroupIdToSend, setResumeGroupIdToSend] = useState("");
  const [resumeHourOfDay, setResumeHourOfDay] = useState("22");
  const [enableGroupResume, setEnableGroupResume] = useState(false);

  const { data: settings, isLoading } = trpc.settings.get.useQuery();
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
    }
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({
      googleApiKey: googleApiKey.trim() || undefined,
      resumeGroupId: resumeGroupId.trim() || undefined,
      resumeGroupIdToSend: resumeGroupIdToSend.trim() || undefined,
      resumeHourOfDay: parseInt(resumeHourOfDay),
      enableGroupResume,
    });
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
                  <Label htmlFor="resumeGroupId">ID do Grupo (Origem)</Label>
                  <Input
                    id="resumeGroupId"
                    placeholder="120363..."
                    value={resumeGroupId}
                    onChange={(e) => setResumeGroupId(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    ID do grupo WhatsApp que será monitorado
                  </p>
                </div>

                {/* Destination Group */}
                <div className="space-y-2">
                  <Label htmlFor="resumeGroupIdToSend">ID do Grupo (Destino)</Label>
                  <Input
                    id="resumeGroupIdToSend"
                    placeholder="120363..."
                    value={resumeGroupIdToSend}
                    onChange={(e) => setResumeGroupIdToSend(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    ID do grupo onde o resumo será enviado (pode ser o mesmo)
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
