import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  RefreshCw,
  BarChart3,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ConnectionRow = { id: number; identification: string; phoneNumber: string | null; status: string };

type RecipientRow = {
  id: number;
  phoneNumber: string;
  name: string | null;
  status: string;
  sentVariantIndex: number | null;
  retryCount: number;
  sentAt: string | null;
  errorMessage: string | null;
};

function parseVariants(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string");
    if (typeof parsed === "string") return [parsed];
  } catch {
    return [raw];
  }
  return [];
}

export default function BaileysCampaignDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const campaignId = parseInt(params.id || "0", 10);

  const { data: campaign, isLoading, refetch } = trpc.baileysCampaigns.get.useQuery(
    { id: campaignId },
    {
      enabled: campaignId > 0,
      refetchInterval: (query) =>
        query.state.data?.status === "running" ? 3000 : false,
    },
  );

  const { data: recipients, refetch: refetchRecipients } = trpc.baileysCampaigns.getRecipients.useQuery(
    { campaignId },
    {
      enabled: campaignId > 0,
      refetchInterval: (query) => {
        const hasPending = query.state.data?.some((r: { status: string }) => r.status === "pending");
        return hasPending ? 5000 : false;
      },
    },
  );

  const { data: stats } = trpc.baileysCampaigns.getStats.useQuery(
    { campaignId },
    { enabled: campaignId > 0, refetchInterval: 5000 },
  );

  const { data: retryStats } = trpc.baileysCampaigns.getRetryStats.useQuery(
    { campaignId },
    { enabled: campaignId > 0, refetchInterval: 10000 },
  );

  const { data: connections } = trpc.whatsapp.list.useQuery();

  const startMutation = trpc.baileysCampaigns.start.useMutation({
    onSuccess: (data) => {
      toast.success(`Disparo iniciado! ${data.pending} mensagem(ns) na fila`);
      refetch();
      refetchRecipients();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseMutation = trpc.baileysCampaigns.pause.useMutation({
    onSuccess: () => {
      toast.success("Disparo pausado!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeMutation = trpc.baileysCampaigns.resume.useMutation({
    onSuccess: () => {
      toast.success("Disparo retomado!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.baileysCampaigns.delete.useMutation({
    onSuccess: () => {
      toast.success("Disparo removido!");
      navigate("/disparos");
    },
    onError: (error) => toast.error(error.message),
  });

  const retryMutation = trpc.baileysCampaigns.retryFailed.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.retried} mensagem(ns) recolocada(s) na fila`);
      refetch();
      refetchRecipients();
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

  const getRecipientStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "outline", label: "Pendente" },
      sent: { variant: "default", label: "Enviada" },
      failed: { variant: "destructive", label: "Falhou" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
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

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/disparos">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Disparo não encontrado</h3>
              <Button asChild>
                <Link href="/disparos">Ver Disparos</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const isOwner = "isOwner" in campaign ? campaign.isOwner : true;
  const progress = campaign.totalRecipients > 0
    ? Math.round(((campaign.sentCount + campaign.failedCount) / campaign.totalRecipients) * 100)
    : 0;
  const variantList = parseVariants(campaign.messageVariants);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/disparos">
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
            {isOwner && (campaign.status === "draft" || campaign.status === "scheduled") && (
              <Button
                onClick={() => startMutation.mutate({ campaignId: campaign.id })}
                disabled={startMutation.isPending || campaign.totalRecipients === 0}
              >
                {startMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Iniciar agora
              </Button>
            )}
            {isOwner && campaign.status === "running" && (
              <Button
                variant="outline"
                onClick={() => pauseMutation.mutate({ campaignId: campaign.id })}
                disabled={pauseMutation.isPending}
              >
                <Pause className="w-4 h-4 mr-2" />
                Pausar
              </Button>
            )}
            {isOwner && campaign.status === "paused" && (
              <Button
                onClick={() => resumeMutation.mutate({ campaignId: campaign.id })}
                disabled={resumeMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Retomar
              </Button>
            )}
            {isOwner && campaign.status !== "running" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação remove permanentemente o disparo e todos os seus dados.
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

        {/* Cards de estatísticas */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total ?? campaign.totalRecipients}</p>
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
                  <p className="text-2xl font-bold">{stats?.pending ?? 0}</p>
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
                  <p className="text-2xl font-bold">{stats?.sent ?? campaign.sentCount}</p>
                  <p className="text-sm text-gray-500">Enviadas</p>
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
                  <p className="text-2xl font-bold">{stats?.failed ?? campaign.failedCount}</p>
                  <p className="text-sm text-gray-500">Falharam</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barra de progresso */}
        {(campaign.status === "running" || campaign.status === "paused" || campaign.status === "completed") && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Progresso do envio</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card de reenvio */}
        {isOwner && retryStats && retryStats.totalFailed > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <RotateCcw className="w-5 h-5" />
                Mensagens falhadas — reenvio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-orange-700 uppercase">Total falhadas</p>
                  <p className="text-2xl font-bold text-orange-900">{retryStats.totalFailed}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700 uppercase">Podem retentar</p>
                  <p className="text-2xl font-bold text-green-600">{retryStats.retriable}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700 uppercase">Limite atingido</p>
                  <p className="text-2xl font-bold text-red-600">{retryStats.maxRetriesReached}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-orange-700 uppercase">Config</p>
                  <p className="text-sm text-orange-800">
                    {retryStats.maxRetries} tentativas / {retryStats.retryDelayMinutes}min
                  </p>
                  <p className="text-xs text-orange-600">
                    Auto-retry: {retryStats.autoRetryEnabled ? "ativado" : "desativado"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
                onClick={() => retryMutation.mutate({ campaignId: campaign.id })}
                disabled={retryMutation.isPending || retryStats.retriable === 0}
              >
                {retryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4 mr-2" />
                )}
                Retentar {retryStats.retriable} mensagens
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Informações do disparo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Informações do disparo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Conexões WhatsApp{campaign.connectionIds && campaign.connectionIds.length > 1 ? ` (${campaign.connectionIds.length})` : ""}
                </p>
                <p className="mt-1">
                  {(campaign.connectionIds && campaign.connectionIds.length > 0
                    ? campaign.connectionIds
                    : campaign.connectionId
                      ? [campaign.connectionId]
                      : []
                  )
                    .map((id: number) => getConnectionName(id))
                    .join(", ")}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Intervalo anti-ban
                </p>
                <p className="mt-1">
                  {campaign.minDelaySeconds}s a {campaign.maxDelaySeconds}s
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Limite diário</p>
                <p className="mt-1">{campaign.dailyLimit ? `${campaign.dailyLimit}/dia` : "Sem limite"}</p>
              </div>
              {campaign.mediaUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Mídia anexada</p>
                  <p className="mt-1 capitalize">{campaign.mediaType ?? "—"}</p>
                  <a
                    href={campaign.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate inline-block max-w-full"
                  >
                    {campaign.mediaUrl}
                  </a>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Criado em</p>
                <p className="mt-1">
                  {format(new Date(campaign.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Agendado para
                  </p>
                  <p className="mt-1 text-blue-600 font-medium">
                    {format(new Date(campaign.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.startedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Iniciado em</p>
                  <p className="mt-1">
                    {format(new Date(campaign.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
              {campaign.completedAt && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Concluído em</p>
                  <p className="mt-1">
                    {format(new Date(campaign.completedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>

            {/* Variações da mensagem */}
            {variantList.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium text-gray-500 mb-2">
                  Variações da mensagem ({variantList.length})
                </p>
                <div className="space-y-2">
                  {variantList.map((v, i) => (
                    <p
                      key={i}
                      className="text-sm text-gray-700 whitespace-pre-wrap border-l-2 border-blue-300 pl-3"
                    >
                      {v}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de destinatários */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Destinatários ({recipients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!recipients || recipients.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum destinatário no disparo</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Variação</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Enviada em</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((recipient: RecipientRow) => (
                      <TableRow key={recipient.id}>
                        <TableCell className="font-mono">{recipient.phoneNumber}</TableCell>
                        <TableCell>{recipient.name || "-"}</TableCell>
                        <TableCell>{getRecipientStatusBadge(recipient.status)}</TableCell>
                        <TableCell>
                          {recipient.sentVariantIndex != null
                            ? `Variação ${recipient.sentVariantIndex + 1}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {recipient.retryCount > 0 ? (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              {recipient.retryCount}x
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
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
