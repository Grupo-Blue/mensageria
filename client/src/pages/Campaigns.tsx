import DashboardLayout from "@/components/DashboardLayout";
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
  Megaphone,
  Eye,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Campaigns() {
  const [, navigate] = useLocation();

  const { data: campaigns, isLoading, refetch } = trpc.campaigns.list.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds for running campaigns
    refetchOnWindowFocus: true,
  });

  const { data: businessAccounts } = trpc.whatsappBusiness.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const startMutation = trpc.campaigns.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Campanha iniciada! ${data.sent} enviadas, ${data.failed} falharam`);
      utils.campaigns.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => {
      toast.success("Campanha pausada!");
      utils.campaigns.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Campanha removida!");
      utils.campaigns.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      draft: { variant: "secondary", label: "Rascunho", icon: <Edit className="w-3 h-3" /> },
      scheduled: { variant: "outline", label: "Agendada", icon: <Clock className="w-3 h-3" /> },
      running: { variant: "default", label: "Em execucao", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
      paused: { variant: "secondary", label: "Pausada", icon: <Pause className="w-3 h-3" /> },
      completed: { variant: "default", label: "Concluida", icon: <CheckCircle2 className="w-3 h-3" /> },
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

  const getBusinessAccountName = (businessAccountId: number) => {
    return businessAccounts?.find((a) => a.id === businessAccountId)?.name || "Conta removida";
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

  const hasBusinessAccounts = businessAccounts && businessAccounts.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campanhas de Marketing</h1>
            <p className="text-gray-600 mt-2">
              Crie e gerencie campanhas de mensagens em massa via WhatsApp Business API
            </p>
          </div>
          {hasBusinessAccounts ? (
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus className="w-4 h-4 mr-2" />
                Nova Campanha
              </Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/whatsapp-business">
                Configurar WhatsApp Business
              </Link>
            </Button>
          )}
        </div>

        {/* No Business Accounts Warning */}
        {!hasBusinessAccounts && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-2 rounded-full bg-yellow-100">
                <Megaphone className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-yellow-900">Configure sua conta WhatsApp Business</p>
                <p className="text-sm text-yellow-700">
                  Para criar campanhas, voce precisa primeiro conectar uma conta da API oficial do WhatsApp Business.
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/whatsapp-business">
                  Configurar
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Campaigns List */}
        {campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => {
              const progress = campaign.totalRecipients > 0
                ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
                : 0;

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
                          {campaign.description || `Template: ${campaign.templateName}`}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {(campaign.status === "draft" || campaign.status === "scheduled") && (
                            <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {(campaign.status === "draft" || campaign.status === "scheduled") && (
                            <DropdownMenuItem
                              onClick={() => startMutation.mutate({ campaignId: campaign.id })}
                              disabled={startMutation.isPending || campaign.totalRecipients === 0}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "running" && (
                            <DropdownMenuItem
                              onClick={() => pauseMutation.mutate({ campaignId: campaign.id })}
                              disabled={pauseMutation.isPending}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
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
                                <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acao ira remover permanentemente a campanha "{campaign.name}" e todos os seus dados.
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-4 gap-4 mb-4">
                      {/* Recipients */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Destinatarios
                        </p>
                        <p className="text-lg font-semibold">{campaign.totalRecipients}</p>
                      </div>

                      {/* Sent */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          Enviadas
                        </p>
                        <p className="text-lg font-semibold text-green-600">{campaign.sentCount}</p>
                      </div>

                      {/* Read */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Lidas
                        </p>
                        <p className="text-lg font-semibold text-blue-600">{campaign.readCount}</p>
                      </div>

                      {/* Failed */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Falharam
                        </p>
                        <p className="text-lg font-semibold text-red-600">{campaign.failedCount}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {campaign.status === "running" && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Progresso</span>
                          <span className="font-medium">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {/* Scheduled Info */}
                    {campaign.status === "scheduled" && campaign.scheduledAt && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg mt-4">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Agendada para {format(new Date(campaign.scheduledAt), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}

                    {/* Footer Info */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t text-sm text-gray-500">
                      <span>
                        Conta: {getBusinessAccountName(campaign.businessAccountId)}
                      </span>
                      <span>
                        Criada {formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : hasBusinessAccounts ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma campanha criada
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Crie sua primeira campanha de marketing para enviar mensagens em massa via WhatsApp Business API.
              </p>
              <Button asChild>
                <Link href="/campaigns/new">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Campanha
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Stats Overview */}
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
                  <p className="text-3xl font-bold text-gray-900">
                    {campaigns.length}
                  </p>
                  <p className="text-sm text-gray-500">Campanhas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {campaigns.reduce((acc, c) => acc + c.sentCount, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Mensagens Enviadas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {campaigns.reduce((acc, c) => acc + c.readCount, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Mensagens Lidas</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {campaigns.reduce((acc, c) => acc + c.failedCount, 0)}
                  </p>
                  <p className="text-sm text-gray-500">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
