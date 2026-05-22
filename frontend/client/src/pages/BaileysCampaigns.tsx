import DashboardLayout from "@/components/DashboardLayout";
import ContactListsManager from "@/components/ContactListsManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Plus,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  BarChart3,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Rocket,
  Eye,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ConnectionRow = { id: number; identification: string; phoneNumber: string | null; status: string };

export default function BaileysCampaigns() {
  const [, navigate] = useLocation();

  const { data: campaigns, isLoading } = trpc.baileysCampaigns.list.useQuery(undefined, {
    refetchInterval: 5000, // Atualiza a cada 5s para acompanhar campanhas em execução
    refetchOnWindowFocus: true,
  });

  const { data: connections } = trpc.whatsapp.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const startMutation = trpc.baileysCampaigns.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Disparo iniciado! ${data.pending} mensagem(ns) na fila`);
      utils.baileysCampaigns.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseMutation = trpc.baileysCampaigns.pause.useMutation({
    onSuccess: () => {
      toast.success("Disparo pausado!");
      utils.baileysCampaigns.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeMutation = trpc.baileysCampaigns.resume.useMutation({
    onSuccess: () => {
      toast.success("Disparo retomado!");
      utils.baileysCampaigns.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.baileysCampaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Disparo removido!");
      utils.baileysCampaigns.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      draft: { variant: "secondary", label: "Rascunho", icon: <Edit className="w-3 h-3" /> },
      scheduled: { variant: "outline", label: "Agendado", icon: <Clock className="w-3 h-3" /> },
      running: { variant: "default", label: "Em execução", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      paused: { variant: "secondary", label: "Pausado", icon: <Pause className="w-3 h-3" /> },
      completed: { variant: "default", label: "Concluído", icon: <CheckCircle2 className="w-3 h-3" /> },
      failed: { variant: "destructive", label: "Falhou", icon: <XCircle className="w-3 h-3" /> },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getConnectionName = (connectionId: number) => {
    const conn = connections?.find((c: ConnectionRow) => c.id === connectionId);
    if (!conn) return "Conexão removida";
    return conn.phoneNumber ? `${conn.identification} (${conn.phoneNumber})` : conn.identification;
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

  const hasConnections = connections && connections.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Disparos WhatsApp</h1>
            <p className="text-gray-600 mt-2">
              Envie mensagens em massa pelo WhatsApp conectado via QR Code, com variações de
              texto e intervalos aleatórios para reduzir o risco de banimento.
            </p>
          </div>
          {hasConnections ? (
            <Button asChild>
              <Link href="/disparos/new">
                <Plus className="w-4 h-4 mr-2" />
                Novo Disparo
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/whatsapp">Conectar WhatsApp</Link>
            </Button>
          )}
        </div>

        {/* Gerenciador de listas de contatos */}
        <ContactListsManager />

        {/* Aviso: nenhuma conexão WhatsApp */}
        {!hasConnections && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-2 rounded-full bg-yellow-100">
                <Rocket className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-yellow-900">Conecte um WhatsApp primeiro</p>
                <p className="text-sm text-yellow-700">
                  Para criar disparos, conecte um número de WhatsApp lendo o QR Code.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/whatsapp">Conectar</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Lista de disparos */}
        {campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const progress = campaign.totalRecipients > 0
                ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
                : 0;
              const isOwner = "isOwner" in campaign && campaign.isOwner;

              return (
                <Card key={campaign.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {campaign.name}
                          {getStatusBadge(campaign.status)}
                        </CardTitle>
                        <CardDescription>
                          {campaign.description || "Disparo em massa via WhatsApp (QR Code)"}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/disparos/${campaign.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {isOwner && <DropdownMenuSeparator />}
                          {isOwner && (campaign.status === "draft" || campaign.status === "scheduled") && (
                            <DropdownMenuItem
                              onClick={() => startMutation.mutate({ campaignId: campaign.id })}
                              disabled={startMutation.isPending || campaign.totalRecipients === 0}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Iniciar agora
                            </DropdownMenuItem>
                          )}
                          {isOwner && campaign.status === "running" && (
                            <DropdownMenuItem
                              onClick={() => pauseMutation.mutate({ campaignId: campaign.id })}
                              disabled={pauseMutation.isPending}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </DropdownMenuItem>
                          )}
                          {isOwner && campaign.status === "paused" && (
                            <DropdownMenuItem
                              onClick={() => resumeMutation.mutate({ campaignId: campaign.id })}
                              disabled={resumeMutation.isPending}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Retomar
                            </DropdownMenuItem>
                          )}
                          {isOwner && <DropdownMenuSeparator />}
                          {isOwner && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  onSelect={(e) => e.preventDefault()}
                                  className="text-red-600"
                                  disabled={campaign.status === "running"}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação remove permanentemente o disparo "{campaign.name}" e todos os seus dados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate({ id: campaign.id })}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-3 gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Destinatários
                        </p>
                        <p className="text-lg font-semibold">{campaign.totalRecipients}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Enviadas
                        </p>
                        <p className="text-lg font-semibold text-green-600">{campaign.sentCount}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Falharam
                        </p>
                        <p className="text-lg font-semibold text-red-600">{campaign.failedCount}</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    {(campaign.status === "running" || campaign.status === "paused") && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Progresso</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {/* Info de agendamento */}
                    {campaign.status === "scheduled" && campaign.scheduledAt && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mt-4">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Agendado para {format(new Date(campaign.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {/* Rodapé */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t text-sm text-gray-500">
                      <span>Conexão: {getConnectionName(campaign.connectionId)}</span>
                      <span>
                        Criado {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum disparo criado</h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Crie seu primeiro disparo em massa via WhatsApp conectado por QR Code.
              </p>
              {hasConnections && (
                <Button asChild>
                  <Link href="/disparos/new">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeiro Disparo
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Resumo geral */}
        {campaigns && campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Resumo Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">{campaigns.length}</p>
                  <p className="text-sm text-gray-500">Disparos</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {campaigns.reduce((acc, c) => acc + c.sentCount, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Mensagens Enviadas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {campaigns.reduce((acc, c) => acc + c.failedCount, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Falhas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {campaigns.filter((c) => c.status === "running").length}
                  </p>
                  <p className="text-sm text-gray-500">Em Execução</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
