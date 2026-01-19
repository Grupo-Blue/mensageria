import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Users,
  CreditCard,
  Wifi,
  WifiOff,
  MessageSquare,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Activity,
  Building2,
  Send,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
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
  LineChart,
  Line,
} from "recharts";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"];

export default function AdminDashboard() {
  const { data: stats, isLoading } = trpc.admin.getDashboardStats.useQuery();
  const { data: userGrowth } = trpc.admin.getUserGrowthChart.useQuery({ days: 30 });
  const { data: revenueData } = trpc.admin.getRevenueChart.useQuery({ months: 6 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const statCards = [
    {
      title: "Total de Usuários",
      value: stats?.totalUsers || 0,
      icon: Users,
      gradient: "from-blue-500 to-cyan-600",
      href: "/admin/users",
      subtext: `+${stats?.newUsersThisMonth || 0} este mês`,
    },
    {
      title: "Assinaturas Ativas",
      value: stats?.activeSubscriptions || 0,
      icon: CreditCard,
      gradient: "from-green-500 to-emerald-600",
      href: "/admin/subscriptions",
      subtext: "Assinaturas pagas",
    },
    {
      title: "Conexões Ativas",
      value: stats?.connectedConnections || 0,
      icon: Wifi,
      gradient: "from-purple-500 to-pink-600",
      href: "/admin/connections",
      subtext: `${stats?.offlineConnections || 0} offline`,
    },
    {
      title: "Contas Business",
      value: stats?.businessAccounts || 0,
      icon: Building2,
      gradient: "from-orange-500 to-red-600",
      href: "/admin/connections",
      subtext: "WhatsApp Business API",
    },
    {
      title: "Campanhas em Execução",
      value: stats?.runningCampaigns || 0,
      icon: Send,
      gradient: "from-indigo-500 to-purple-600",
      href: "/admin/connections",
      subtext: "Em andamento",
    },
    {
      title: "Erros (24h)",
      value: stats?.errorsLast24h || 0,
      icon: AlertTriangle,
      gradient: "from-red-500 to-rose-600",
      href: "/admin/errors",
      subtext: "Últimas 24 horas",
    },
    {
      title: "MRR",
      value: formatCurrency(stats?.mrr || 0),
      icon: DollarSign,
      gradient: "from-emerald-500 to-teal-600",
      href: "/admin/subscriptions",
      subtext: "Receita Mensal Recorrente",
    },
    {
      title: "Conexões Offline",
      value: stats?.offlineConnections || 0,
      icon: WifiOff,
      gradient: "from-gray-500 to-slate-600",
      href: "/admin/connections",
      subtext: "Requer atenção",
    },
  ];

  const pieData =
    stats?.usersByPlan?.map((p: any) => ({
      name: p.planName || "Sem plano",
      value: Number(p.count),
    })) || [];

  return (
    <DashboardLayout
      title="Admin Dashboard"
      description="Visão geral do sistema"
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* Quick Actions */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <Users className="w-4 h-4 mr-2" />
              Gerenciar Usuários
            </Button>
          </Link>
          <Link href="/admin/subscriptions">
            <Button variant="outline" size="sm">
              <CreditCard className="w-4 h-4 mr-2" />
              Assinaturas
            </Button>
          </Link>
          <Link href="/admin/errors">
            <Button variant="outline" size="sm">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Erros do Sistema
            </Button>
          </Link>
          <Link href="/admin/settings">
            <Button variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Configurações
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <motion.div key={stat.title} variants={item}>
              <Link href={stat.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div
                      className={`p-2 rounded-lg bg-gradient-to-r ${stat.gradient}`}
                    >
                      <stat.icon className="h-4 w-4 text-white" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {isLoading ? "..." : stat.value}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.subtext}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Crescimento de Usuários
                </CardTitle>
                <CardDescription>Novos usuários nos últimos 30 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowth as any[] || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        }
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString("pt-BR")
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: "#3B82F6" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Plan Distribution */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Planos</CardTitle>
                <CardDescription>Usuários por plano</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
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
                        outerRadius={100}
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
          </motion.div>
        </div>

        {/* Revenue Chart */}
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receita Mensal</CardTitle>
              <CardDescription>Receita dos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData as any[] || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
