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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6"];

export default function AdminErrors() {
  const [page, setPage] = useState(0);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string | undefined>(undefined);
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>(undefined);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const limit = 20;

  const { data, isLoading, refetch } = trpc.admin.listErrors.useQuery({
    limit,
    offset: page * limit,
    errorType: errorTypeFilter,
    resolved: resolvedFilter,
  });

  const { data: stats } = trpc.admin.getErrorStats.useQuery();

  const resolveMutation = trpc.admin.resolveError.useMutation({
    onSuccess: () => {
      toast.success("Erro marcado como resolvido");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleExpand = (id: number) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedErrors(newExpanded);
  };

  const getErrorTypeBadge = (type: string) => {
    switch (type) {
      case "message_send_failed":
        return <Badge variant="destructive">Envio Falhou</Badge>;
      case "webhook_failed":
        return <Badge className="bg-yellow-500">Webhook</Badge>;
      case "auth_failed":
        return <Badge className="bg-orange-500">Autenticação</Badge>;
      case "rate_limit":
        return <Badge className="bg-purple-500">Rate Limit</Badge>;
      case "api_error":
        return <Badge variant="secondary">API</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / limit);

  const pieData =
    stats?.errorsByType?.map((e: any) => ({
      name: e.errorType,
      value: Number(e.count),
    })) || [];

  return (
    <DashboardLayout
      title="Monitoramento de Erros"
      description="Visualize e gerencie erros do sistema"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Erros Não Resolvidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {stats?.unresolvedCount || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Erros (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.errorsByType?.reduce(
                  (acc: number, e: any) => acc + Number(e.count),
                  0
                ) || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tipos de Erro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.errorsByType?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Errors by Hour */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Erros por Hora</CardTitle>
              <CardDescription>Últimas 24 horas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.errorsPerHour as any[] || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      }
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Errors by Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Erros por Tipo</CardTitle>
              <CardDescription>Distribuição de erros</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Errors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Erros</CardTitle>
            <CardDescription>Total de {data?.total || 0} erros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Select
                value={errorTypeFilter || "all"}
                onValueChange={(value) =>
                  setErrorTypeFilter(value === "all" ? undefined : value)
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de erro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="message_send_failed">
                    Envio de Mensagem
                  </SelectItem>
                  <SelectItem value="webhook_failed">Webhook</SelectItem>
                  <SelectItem value="auth_failed">Autenticação</SelectItem>
                  <SelectItem value="rate_limit">Rate Limit</SelectItem>
                  <SelectItem value="api_error">API</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={
                  resolvedFilter === undefined
                    ? "all"
                    : resolvedFilter
                      ? "resolved"
                      : "unresolved"
                }
                onValueChange={(value) =>
                  setResolvedFilter(
                    value === "all" ? undefined : value === "resolved"
                  )
                }
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="unresolved">Não Resolvidos</SelectItem>
                  <SelectItem value="resolved">Resolvidos</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>

            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : data?.errors?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum erro encontrado
                </div>
              ) : (
                data?.errors?.map((item: any) => (
                  <Collapsible
                    key={item.error.id}
                    open={expandedErrors.has(item.error.id)}
                    onOpenChange={() => toggleExpand(item.error.id)}
                  >
                    <Card className="border">
                      <CollapsibleTrigger asChild>
                        <div className="p-4 cursor-pointer hover:bg-muted/50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {item.error.resolved ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-red-500" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                {getErrorTypeBadge(item.error.errorType)}
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(item.error.createdAt)}
                                </span>
                              </div>
                              <div className="text-sm mt-1 line-clamp-1">
                                {item.error.message}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.user && (
                              <span className="text-sm text-muted-foreground">
                                {item.user.name || item.user.email}
                              </span>
                            )}
                            {expandedErrors.has(item.error.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 border-t">
                          <div className="mt-4 space-y-3">
                            <div>
                              <label className="text-sm font-medium">
                                Mensagem completa:
                              </label>
                              <p className="text-sm mt-1 bg-muted p-2 rounded">
                                {item.error.message}
                              </p>
                            </div>
                            {item.error.errorCode && (
                              <div>
                                <label className="text-sm font-medium">
                                  Código:
                                </label>
                                <p className="text-sm mt-1">
                                  {item.error.errorCode}
                                </p>
                              </div>
                            )}
                            {item.error.context && (
                              <div>
                                <label className="text-sm font-medium">
                                  Contexto:
                                </label>
                                <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto max-h-40">
                                  {item.error.context}
                                </pre>
                              </div>
                            )}
                            {item.error.stackTrace && (
                              <div>
                                <label className="text-sm font-medium">
                                  Stack Trace:
                                </label>
                                <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto max-h-40">
                                  {item.error.stackTrace}
                                </pre>
                              </div>
                            )}
                            {!item.error.resolved && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  resolveMutation.mutate({
                                    errorId: item.error.id,
                                  })
                                }
                                disabled={resolveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Marcar como Resolvido
                              </Button>
                            )}
                            {item.error.resolved && item.error.resolvedAt && (
                              <div className="text-sm text-muted-foreground">
                                Resolvido em {formatDate(item.error.resolvedAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))
              )}
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
    </DashboardLayout>
  );
}
