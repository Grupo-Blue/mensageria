import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  Edit,
  Users,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const campaignId = parseInt(params.id || "0");

  const { data: campaign, isLoading, refetch } = trpc.campaigns.get.useQuery(
    { id: campaignId },
    {
      enabled: campaignId > 0,
      refetchInterval: (query) => {
        // Poll every 3 seconds if campaign is running
        return query.state.data?.status === "running" ? 3000 : false;
      },
    }
  );

  const { data: recipients, refetch: refetchRecipients } = trpc.campaigns.getRecipients.useQuery(
    { campaignId },
    {
      enabled: campaignId > 0,
      refetchInterval: (query) => {
        // Poll if any recipient is still pending or sent
        const data = query.state.data;
        const hasPending = data?.some((r: { status: string }) => r.status === "pending" || r.status === "sent");
        return hasPending ? 5000 : false;
      },
    }
  );

  const { data: stats } = trpc.campaigns.getStats.useQuery(
    { campaignId },
    {
      enabled: campaignId > 0,
      refetchInterval: 5000,
    }
  );

  const { data: businessAccounts } = trpc.whatsappBusiness.list.useQuery();

  const utils = trpc.useUtils();

  const startMutation = trpc.campaigns.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Campanha iniciada! ${data.sent} enviadas, ${data.failed} falharam`);
      refetch();
      refetchRecipients();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => {
      toast.success("Campanha pausada!");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Campanha removida!");
      navigate("/campaigns");
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

  const getRecipientStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pendente" },
      sent: { variant: "secondary", label: "Enviada" },
      delivered: { variant: "default", label: "Entregue" },
      read: { variant: "default", label: "Lida" },
      failed: { variant: "destructive", label: "Falhou" },
    };

    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/campaigns">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Campanha nao encontrada
              </h3>
              <Button asChild>
                <Link href="/campaigns">Ver Campanhas</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const progress = campaign.totalRecipients > 0
    ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/campaigns">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{campaign.name}</h1>
                {getStatusBadge(campaign.status)}
              </div>
              {campaign.description && (
                <p className="text-gray-600 mt-1">{campaign.description}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                refetch();
                refetchRecipients();
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {(campaign.status === "draft" || campaign.status === "scheduled") && (
              <Button
                onClick={() => startMutation.mutate({ campaignId: campaign.id })}
                disabled={startMutation.isPending || campaign.totalRecipients === 0}
              >
                {startMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Iniciar Campanha
              </Button>
            )}
            {campaign.status === "running" && (
              <Button
                variant="outline"
                onClick={() => pauseMutation.mutate({ campaignId: campaign.id })}
                disabled={pauseMutation.isPending}
              >
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
            )}
            {campaign.status !== "running" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acao ira remover permanentemente a campanha e todos os seus dados.
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
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-sm text-gray-500">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                  <p className="text-sm text-gray-500">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Send className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                  <p className="text-sm text-gray-500">Enviadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.read || 0}</p>
                  <p className="text-sm text-gray-500">Lidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                  <p className="text-sm text-gray-500">Falharam</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar (if running) */}
        {(campaign.status === "running" || campaign.status === "completed") && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Progresso do Envio</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Informacoes da Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Conta WhatsApp</p>
                <p className="mt-1">{getBusinessAccountName(campaign.businessAccountId)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Template</p>
                <p className="mt-1">{campaign.templateName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Idioma</p>
                <p className="mt-1">{campaign.templateLanguage}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Criada em</p>
                <p className="mt-1">
                  {format(new Date(campaign.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Agendada para
                  </p>
                  <p className="mt-1 text-blue-600 font-medium">
                    {format(new Date(campaign.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.startedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Iniciada em</p>
                  <p className="mt-1">
                    {format(new Date(campaign.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.completedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Concluida em</p>
                  <p className="mt-1">
                    {format(new Date(campaign.completedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recipients Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Destinatarios ({recipients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recipients || recipients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum destinatario na campanha</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviada em</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((recipient) => (
                      <TableRow key={recipient.id}>
                        <TableCell className="font-mono">{recipient.phoneNumber}</TableCell>
                        <TableCell>{recipient.name || "-"}</TableCell>
                        <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                        <TableCell>
                          {recipient.sentAt
                            ? format(new Date(recipient.sentAt), "dd/MM HH:mm", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-red-600">
                          {recipient.errorMessage || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
