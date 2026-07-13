import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Smartphone,
  Gauge,
  ListChecks,
  Rocket,
  AlertTriangle,
  ArrowRight,
  QrCode,
  WifiOff,
  ShieldAlert,
  PauseCircle,
  Send,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

const HISTORY_DAYS = 30;

const formatNumber = (value: number): string => value.toLocaleString("pt-BR");

/**
 * A série vem como "YYYY-MM-DD". Fatiar a string em vez de usar new Date(): a string
 * seria lida como UTC e, no fuso do Brasil, o gráfico mostraria o dia anterior.
 */
const formatDayLabel = (date: string): string => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

interface Alert {
  key: string;
  icon: typeof AlertTriangle;
  message: string;
  href: string;
}

export default function Home() {
  const { data: overview, isLoading: loadingOverview } = trpc.dashboard.overview.useQuery();
  const { data: connections, isLoading: loadingConnections, isError: errorConnections } =
    trpc.dashboard.connectionsHealth.useQuery();
  const { data: history, isLoading: loadingHistory, isError: errorHistory } = trpc.dashboard.sendHistory.useQuery({
    days: HISTORY_DAYS,
  });

  const connectionStats = overview?.connections;
  const capacity = overview?.capacity;
  const queue = overview?.queue;
  const campaigns = overview?.campaigns;

  // Alertas: só o que pede ação. Um chip caído significa campanha disparando com
  // menos capacidade — é o prejuízo silencioso deste tipo de sistema.
  const alerts: Alert[] = [];
  for (const conn of connections ?? []) {
    const label = conn.phoneNumber || conn.identification;
    if (conn.status === "disconnected") {
      const since = conn.lastConnectedAt
        ? ` (último contato ${formatDistanceToNow(new Date(conn.lastConnectedAt), { addSuffix: true, locale: ptBR })})`
        : "";
      alerts.push({
        key: `down-${conn.id}`,
        icon: WifiOff,
        message: `${label} está desconectado${since} — os disparos não saem por esse número.`,
        href: "/whatsapp",
      });
    }
    if (conn.status === "qr_code") {
      alerts.push({
        key: `qr-${conn.id}`,
        icon: QrCode,
        message: `${label} está aguardando a leitura do QR Code.`,
        href: "/whatsapp",
      });
    }
    if (conn.proxyStatus === "dead") {
      alerts.push({
        key: `proxy-${conn.id}`,
        icon: ShieldAlert,
        message: `O proxy de ${label} está morto — o IP de saída não está fixo.`,
        href: "/connections",
      });
    }
    if (conn.status === "connected" && conn.warmupDailyLimit != null && conn.sentToday >= conn.warmupDailyLimit) {
      alerts.push({
        key: `warmup-${conn.id}`,
        icon: Gauge,
        message: `${label} atingiu o teto de aquecimento do dia (${formatNumber(conn.warmupDailyLimit)}) e foi pausado até amanhã.`,
        href: "/connections",
      });
    }
  }
  if (campaigns && campaigns.paused > 0) {
    alerts.push({
      key: "paused",
      icon: PauseCircle,
      message: `${campaigns.paused} campanha(s) pausada(s) — retome em Disparos para continuar o envio.`,
      href: "/disparos",
    });
  }

  const capacityPercent =
    capacity?.dailyLimit && capacity.dailyLimit > 0
      ? Math.min(100, Math.round((capacity.usedAgainstLimit / capacity.dailyLimit) * 100))
      : 0;

  const hasHistory = (history?.totals.sent ?? 0) + (history?.totals.failed ?? 0) > 0;

  // Cada card declara de quais queries depende: o de capacidade cai no total de
  // "enviadas hoje" (que vem do histórico) quando nenhum telefone tem teto definido,
  // então precisa esperar as duas — senão mostraria 0 enquanto o histórico não chega.
  const cards = [
    {
      title: "Telefones",
      icon: Smartphone,
      gradient: "from-green-500 to-emerald-600",
      href: "/whatsapp",
      loading: loadingOverview,
      value: connectionStats ? `${connectionStats.connected} de ${connectionStats.total}` : "—",
      caption: connectionStats
        ? [
            `${connectionStats.connected} conectados`,
            connectionStats.connecting > 0 ? `${connectionStats.connecting} conectando` : null,
            connectionStats.qrCode > 0 ? `${connectionStats.qrCode} aguardando QR` : null,
            connectionStats.disconnected > 0 ? `${connectionStats.disconnected} caídos` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "",
    },
    {
      title: "Capacidade hoje",
      icon: Gauge,
      gradient: "from-blue-500 to-cyan-600",
      href: "/connections",
      loading: loadingOverview || loadingHistory,
      value: capacity
        ? capacity.dailyLimit != null
          ? `${formatNumber(capacity.usedAgainstLimit)} / ${formatNumber(capacity.dailyLimit)}`
          : formatNumber(history?.totals.sentToday ?? 0)
        : "—",
      caption: capacity
        ? capacity.dailyLimit != null
          ? [
              `${capacityPercent}% do teto de aquecimento consumido`,
              // Sem isto, um chip disparando sem teto ficaria invisível no card.
              capacity.uncappedConnections > 0
                ? `${capacity.uncappedConnections} telefone(s) sem teto`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Enviadas hoje · nenhum teto de aquecimento definido"
        : "",
    },
    {
      title: "Na fila",
      icon: ListChecks,
      gradient: "from-purple-500 to-pink-600",
      href: "/disparos",
      loading: loadingOverview,
      value: queue ? formatNumber(queue.pending) : "—",
      caption: queue
        ? queue.pending === 0
          ? "Nada aguardando envio"
          : queue.etaMinutes != null
            ? `~${formatDuration(queue.etaMinutes)} no ritmo atual`
            : "Sem telefone conectado para disparar"
        : "",
    },
    {
      title: "Campanhas ativas",
      icon: Rocket,
      gradient: "from-orange-500 to-red-600",
      href: "/disparos",
      loading: loadingOverview,
      value: campaigns ? formatNumber(campaigns.running) : "—",
      caption: campaigns
        ? [
            campaigns.scheduled > 0 ? `${campaigns.scheduled} agendada(s)` : null,
            campaigns.paused > 0 ? `${campaigns.paused} pausada(s)` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Nenhuma campanha pausada ou agendada"
        : "",
    },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto p-4 sm:p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-lg">
              A operação agora e o histórico dos seus disparos
            </p>
          </motion.div>

          {/* AGORA — auto-fill evita 4 colunas espremidas quando a sidebar está aberta */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-4 sm:gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15.5rem),1fr))]"
          >
            {cards.map((card) => (
              <motion.div key={card.title} variants={item} className="min-w-0 flex">
                <Link href={card.href} className="block h-full min-w-0 flex-1">
                  <Card className="group relative h-full min-w-0 overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex gap-3 sm:gap-4 min-w-0">
                        <div
                          className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} shadow-md`}
                        >
                          <card.icon className="h-5 w-5 text-white" />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 leading-tight">
                            {card.title}
                          </p>

                          {card.loading ? (
                            <>
                              <Skeleton className="h-7 sm:h-8 w-20" />
                              <Skeleton className="h-3.5 w-full" />
                              <Skeleton className="h-3.5 w-4/5" />
                            </>
                          ) : (
                            <>
                              <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-none tabular-nums tracking-tight [overflow-wrap:anywhere]">
                                {card.value}
                              </p>

                              {card.caption ? (
                                <ul className="space-y-0.5 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium leading-snug">
                                  {card.caption.split(" · ").map((part, index) => (
                                    <li key={`${card.title}-${index}`} className="[overflow-wrap:anywhere]">
                                      {part}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {card.title === "Capacidade hoje" && capacity?.dailyLimit != null && (
                                <Progress value={capacityPercent} className="mt-1 h-1.5" />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* ALERTAS */}
          {alerts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-bold text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="w-5 h-5" />
                    Precisa da sua atenção
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((alert) => (
                    <Link key={alert.key} href={alert.href}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/70 dark:bg-gray-900/40 border border-amber-200/60 dark:border-amber-900/40 hover:border-amber-400 transition-colors cursor-pointer group">
                        <alert.icon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium flex-1">
                          {alert.message}
                        </span>
                        <ArrowRight className="w-4 h-4 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* HISTÓRICO DE ENVIO */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-800/50">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl font-black text-gray-900 dark:text-white">
                      Histórico de envio
                    </CardTitle>
                    <CardDescription className="text-base">
                      Campanhas e envios avulsos somados, nos últimos {HISTORY_DAYS} dias
                    </CardDescription>
                  </div>
                  {history && hasHistory && (
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Enviadas</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          {formatNumber(history.totals.sent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Taxa de falha</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          {history.totals.failureRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Ritmo</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-white">
                          {formatNumber(history.totals.dailyAverage)}
                          <span className="text-sm font-semibold text-gray-500">/dia</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingHistory ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : errorHistory ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      Não foi possível carregar o histórico
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Isto é uma falha de leitura — não significa que nada foi enviado. Recarregue a página.
                    </p>
                  </div>
                ) : hasHistory ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={history?.series ?? []}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="date" tickFormatter={formatDayLabel} fontSize={12} />
                        <YAxis fontSize={12} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={(value: string) => formatDayLabel(value)}
                          formatter={(value: number, name: string) => [formatNumber(value), name]}
                        />
                        <Legend />
                        <Bar dataKey="sent" name="Enviadas" stackId="envios" fill="#10B981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="failed" name="Falhas" stackId="envios" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4">
                      <Send className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">Nenhum disparo ainda</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                      Assim que a primeira campanha rodar, o histórico aparece aqui.
                    </p>
                    <Link href="/disparos/new">
                      <Button className="gap-2">
                        Criar disparo
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  O WhatsApp via QR Code confirma apenas o envio — entrega e leitura só existem nas campanhas pela API
                  oficial da Meta.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* TELEFONES */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-800/50">
              <CardHeader className="border-b border-gray-200 dark:border-gray-700">
                <CardTitle className="text-2xl font-black text-gray-900 dark:text-white">Telefones</CardTitle>
                <CardDescription className="text-base">
                  Quanto cada número já disparou hoje e quanto ainda cabe no aquecimento
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {loadingConnections ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : errorConnections ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-3" />
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      Não foi possível carregar os telefones
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Falha de leitura — recarregue a página.
                    </p>
                  </div>
                ) : (connections?.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">Nenhum telefone conectado</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                      Conecte um WhatsApp para começar a disparar.
                    </p>
                    <Link href="/whatsapp">
                      <Button className="gap-2">
                        Conectar WhatsApp
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connections?.map((conn) => {
                      const warmupPercent =
                        conn.warmupDailyLimit && conn.warmupDailyLimit > 0
                          ? Math.min(100, Math.round((conn.sentToday / conn.warmupDailyLimit) * 100))
                          : null;

                      return (
                        <div
                          key={conn.id}
                          className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30"
                        >
                          <div
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              conn.status === "connected"
                                ? "bg-green-500"
                                : conn.status === "disconnected"
                                  ? "bg-red-500"
                                  : "bg-amber-500"
                            }`}
                          />
                          <div className="min-w-[180px] flex-1">
                            <p className="font-bold text-gray-900 dark:text-white">
                              {conn.phoneNumber || conn.identification}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {conn.status === "connected"
                                ? "Conectado"
                                : conn.status === "disconnected"
                                  ? "Desconectado"
                                  : conn.status === "qr_code"
                                    ? "Aguardando QR"
                                    : "Conectando"}
                            </p>
                          </div>
                          <div className="min-w-[120px]">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Hoje</p>
                            <p className="text-lg font-black text-gray-900 dark:text-white">
                              {formatNumber(conn.sentToday)}
                            </p>
                          </div>
                          <div className="min-w-[200px] flex-1">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Aquecimento
                            </p>
                            {warmupPercent != null ? (
                              <div className="flex items-center gap-3">
                                <Progress value={warmupPercent} className="h-2 flex-1" />
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                  {formatNumber(conn.sentToday)}/{formatNumber(conn.warmupDailyLimit ?? 0)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">Sem teto definido</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Minutos → "2h 30min" / "45min", para o ETA da fila. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`;
}
