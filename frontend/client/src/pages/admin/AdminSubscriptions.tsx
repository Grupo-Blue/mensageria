import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  MoreHorizontal,
  RefreshCw,
  Ban,
  Pause,
  Play,
  ArrowUpCircle,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function AdminSubscriptions() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [extendDays, setExtendDays] = useState("30");
  const limit = 20;

  const { data, isLoading, refetch } = trpc.admin.listSubscriptions.useQuery({
    limit,
    offset: page * limit,
    status: statusFilter as any,
  });

  const { data: plans } = trpc.admin.listPlans.useQuery();

  const cancelMutation = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura cancelada com sucesso");
      setShowCancelDialog(false);
      setCancelReason("");
      setSelectedSubscription(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseMutation = trpc.admin.pauseSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura pausada com sucesso");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeMutation = trpc.admin.resumeSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura reativada com sucesso");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const changePlanMutation = trpc.admin.changePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano alterado com sucesso");
      setShowChangePlanDialog(false);
      setSelectedPlanId(null);
      setSelectedSubscription(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const extendMutation = trpc.admin.extendSubscription.useMutation({
    onSuccess: () => {
      toast.success("Assinatura estendida com sucesso");
      setShowExtendDialog(false);
      setExtendDays("30");
      setSelectedSubscription(null);
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "canceled":
        return <Badge variant="destructive">Cancelado</Badge>;
      case "past_due":
        return <Badge className="bg-yellow-500">Inadimplente</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausado</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Trial</Badge>;
      case "incomplete":
        return <Badge variant="outline">Incompleto</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <DashboardLayout
      title="Gerenciamento de Assinaturas"
      description="Visualize e gerencie todas as assinaturas da plataforma"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas</CardTitle>
            <CardDescription>
              Total de {data?.total || 0} assinaturas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) =>
                  setStatusFilter(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                  <SelectItem value="past_due">Inadimplente</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ciclo</TableHead>
                    <TableHead>Período Atual</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : data?.subscriptions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Nenhuma assinatura encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.subscriptions?.map((item: any) => (
                      <TableRow key={item.subscription.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.user?.name || "Sem nome"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.user?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.plan?.name || "-"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.plan
                                ? formatCurrency(parseFloat(item.plan.priceMonthly))
                                : "-"}
                              /mês
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(item.subscription.status)}
                        </TableCell>
                        <TableCell>
                          {item.subscription.billingCycle === "yearly"
                            ? "Anual"
                            : "Mensal"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(item.subscription.currentPeriodStart)} -{" "}
                            {formatDate(item.subscription.currentPeriodEnd)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSubscription(item.subscription);
                                  setShowChangePlanDialog(true);
                                }}
                              >
                                <ArrowUpCircle className="h-4 w-4 mr-2" />
                                Alterar Plano
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSubscription(item.subscription);
                                  setShowExtendDialog(true);
                                }}
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Estender Período
                              </DropdownMenuItem>
                              {item.subscription.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    pauseMutation.mutate({
                                      subscriptionId: item.subscription.id,
                                    })
                                  }
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar
                                </DropdownMenuItem>
                              )}
                              {item.subscription.status === "paused" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    resumeMutation.mutate({
                                      subscriptionId: item.subscription.id,
                                    })
                                  }
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Reativar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSubscription(item.subscription);
                                  setShowCancelDialog(true);
                                }}
                                className="text-red-600"
                              >
                                <Ban className="h-4 w-4 mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {page * limit + 1} a{" "}
                  {Math.min((page + 1) * limit, data?.total || 0)} de{" "}
                  {data?.total || 0}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Esta ação irá cancelar a assinatura imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedSubscription) {
                  cancelMutation.mutate({
                    subscriptionId: selectedSubscription.id,
                    reason: cancelReason,
                  });
                }
              }}
              disabled={!cancelReason || cancelMutation.isPending}
            >
              Cancelar Assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano</DialogTitle>
            <DialogDescription>
              Selecione o novo plano para esta assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedPlanId?.toString() || ""}
              onValueChange={(value) => setSelectedPlanId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((plan: any) => (
                  <SelectItem key={plan.id} value={plan.id.toString()}>
                    {plan.name} - {formatCurrency(plan.priceMonthly)}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowChangePlanDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedSubscription && selectedPlanId) {
                  changePlanMutation.mutate({
                    subscriptionId: selectedSubscription.id,
                    planId: selectedPlanId,
                  });
                }
              }}
              disabled={!selectedPlanId || changePlanMutation.isPending}
            >
              Alterar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estender Período</DialogTitle>
            <DialogDescription>
              Adicione dias extras ao período atual da assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Dias a adicionar</label>
              <Input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
                min="1"
                max="365"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedSubscription && extendDays) {
                  extendMutation.mutate({
                    subscriptionId: selectedSubscription.id,
                    days: parseInt(extendDays),
                  });
                }
              }}
              disabled={!extendDays || extendMutation.isPending}
            >
              Estender
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
