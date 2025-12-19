import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Bot, Send, CheckCircle, XCircle, Clock, TrendingUp, Users, Zap, ArrowRight, Activity } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

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

export default function Home() {
  const { data: whatsappConnections, isLoading: loadingWhatsapp } = trpc.whatsapp.list.useQuery();
  const { data: telegramConnections, isLoading: loadingTelegram } = trpc.telegram.list.useQuery();
  const { data: messages, isLoading: loadingMessages } = trpc.messages.list.useQuery({ limit: 10 });

  const whatsappConnected = whatsappConnections?.filter(c => c.status === "connected").length || 0;
  const telegramConnected = telegramConnections?.filter(c => c.status === "connected").length || 0;
  const totalMessages = messages?.length || 0;
  const messagesSent = messages?.filter(m => m.status === "sent").length || 0;
  const successRate = totalMessages > 0 ? Math.round((messagesSent / totalMessages) * 100) : 0;

  const stats = [
    {
      title: "WhatsApp Conectados",
      value: loadingWhatsapp ? "..." : whatsappConnected,
      total: whatsappConnections?.length || 0,
      icon: MessageSquare,
      gradient: "from-green-500 to-emerald-600",
      iconBg: "bg-green-500",
      href: "/whatsapp",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: "Telegram Conectados",
      value: loadingTelegram ? "..." : telegramConnected,
      total: telegramConnections?.length || 0,
      icon: Bot,
      gradient: "from-blue-500 to-cyan-600",
      iconBg: "bg-blue-500",
      href: "/telegram",
      trend: "+8%",
      trendUp: true,
    },
    {
      title: "Mensagens Enviadas",
      value: loadingMessages ? "..." : messagesSent,
      total: totalMessages,
      icon: Send,
      gradient: "from-purple-500 to-pink-600",
      iconBg: "bg-purple-500",
      href: "/send",
      trend: "+24%",
      trendUp: true,
    },
    {
      title: "Taxa de Sucesso",
      value: loadingMessages ? "..." : `${successRate}%`,
      total: 100,
      icon: Activity,
      gradient: "from-orange-500 to-red-600",
      iconBg: "bg-orange-500",
      href: "/send",
      trend: "+5%",
      trendUp: true,
    },
  ];

  const quickActions = [
    {
      title: "Conectar WhatsApp",
      description: "Adicionar nova conexão",
      icon: MessageSquare,
      gradient: "from-green-400 to-emerald-500",
      href: "/whatsapp",
    },
    {
      title: "Conectar Telegram",
      description: "Adicionar bot",
      icon: Bot,
      gradient: "from-blue-400 to-cyan-500",
      href: "/telegram",
    },
    {
      title: "Enviar Mensagem",
      description: "Enviar para WhatsApp ou Telegram",
      icon: Send,
      gradient: "from-purple-400 to-pink-500",
      href: "/send",
    },
    {
      title: "Criar Campanha",
      description: "Envio em massa automatizado",
      icon: Zap,
      gradient: "from-orange-400 to-red-500",
      href: "/campaigns/new",
    },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        <div className="space-y-8 max-w-7xl mx-auto p-6">
        {/* Header with enhanced gradient and effects */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-12 text-white shadow-2xl border border-white/20"
        >
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-4 mb-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="text-6xl"
                >
                  👋
                </motion.div>
                <div>
                  <h1 className="text-5xl font-black mb-2 tracking-tight drop-shadow-lg">Bem-vindo ao Mensageria!</h1>
                  <p className="text-blue-100 text-xl font-medium">Gerencie suas conexões e mensagens em um só lugar</p>
                </div>
              </div>
            </motion.div>
          </div>
          {/* Enhanced decorative elements */}
          <motion.div 
            className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -ml-48 -mb-48"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />
          <motion.div 
            className="absolute top-1/2 right-1/4 w-64 h-64 bg-yellow-400/20 rounded-full blur-2xl"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, delay: 2 }}
          />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAzNGMwIDMuMzE0LTIuNjg2IDYtNiA2cy02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNiA2IDIuNjg2IDYgNnoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz48L2c+PC9zdmc+')] opacity-20" />
        </motion.div>

        {/* Stats Grid - Enhanced Design */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {stats.map((stat, index) => (
            <motion.div key={stat.title} variants={item}>
              <Link href={stat.href}>
                <Card className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 backdrop-blur-sm">
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  
                  {/* Shine effect on hover */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        {stat.title}
                      </CardTitle>
                      <motion.div
                        whileHover={{ scale: 1.15, rotate: 10 }}
                        className={`p-3.5 rounded-2xl bg-gradient-to-br ${stat.gradient} shadow-xl shadow-${stat.iconBg}/20`}
                      >
                        <stat.icon className="w-6 h-6 text-white" />
                      </motion.div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-5xl font-black bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent tracking-tight">
                          {stat.value}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-semibold">
                          de {stat.total} total
                        </p>
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r ${stat.trendUp ? 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' : 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20'} border ${stat.trendUp ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
                      <TrendingUp className={`w-4 h-4 ${stat.trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} />
                      <span className={`text-sm font-bold ${stat.trendUp ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {stat.trend}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">vs último mês</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Actions - Enhanced Design */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-black text-gray-900 dark:text-white mb-2">Ações Rápidas</CardTitle>
                  <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                    Acesse rapidamente as funcionalidades principais
                  </CardDescription>
                </div>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="p-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg"
                >
                  <Zap className="w-8 h-8 text-white" />
                </motion.div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickActions.map((action, index) => (
                  <Link key={action.title} href={action.href}>
                    <motion.div
                      whileHover={{ scale: 1.03, y: -8 }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="group relative overflow-hidden rounded-2xl p-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-transparent transition-all cursor-pointer shadow-lg hover:shadow-2xl"
                    >
                      {/* Animated gradient overlay on hover */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      
                      {/* Shine effect */}
                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                      
                      <div className="relative z-10">
                        <motion.div
                          whileHover={{ rotate: 360, scale: 1.1 }}
                          transition={{ duration: 0.6 }}
                          className="mb-6 inline-block"
                        >
                          <div className={`p-5 rounded-2xl bg-gradient-to-br ${action.gradient} shadow-xl group-hover:shadow-2xl transition-shadow`}>
                            <action.icon className="w-8 h-8 text-white" />
                          </div>
                        </motion.div>
                        
                        <div className="space-y-3">
                          <div className="font-black text-xl text-gray-900 dark:text-white group-hover:text-white flex items-center gap-3 transition-colors">
                            {action.title}
                            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-2" />
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/90 transition-colors font-semibold leading-relaxed">
                            {action.description}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Messages - Enhanced Design */}
        {messages && messages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-gray-50 via-gray-100 to-gray-50 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl font-black text-gray-900 dark:text-white mb-2">Mensagens Recentes</CardTitle>
                    <CardDescription className="text-base text-gray-600 dark:text-gray-400">
                      Últimas {messages.length} mensagens enviadas
                    </CardDescription>
                  </div>
                  <Link href="/send">
                    <Button className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg hover:shadow-xl transition-all">
                      Ver Todas
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-center justify-between p-6 bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl hover:shadow-xl transition-all group border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700"
                    >
                      <div className="flex items-center space-x-5 flex-1 min-w-0">
                        <motion.div
                          whileHover={{ scale: 1.15, rotate: 5 }}
                          className={`p-4 rounded-2xl shadow-lg ${message.platform === "whatsapp" ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-blue-500 to-cyan-600"}`}
                        >
                          {message.platform === "whatsapp" ? (
                            <MessageSquare className="w-6 h-6 text-white" />
                          ) : (
                            <Bot className="w-6 h-6 text-white" />
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 dark:text-white text-lg mb-1">
                            {message.recipient}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-md font-medium">
                            {message.content}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-5 flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {message.status === "sent" && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full border border-green-200 dark:border-green-800 shadow-sm">
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                              <span className="text-sm font-bold text-green-700 dark:text-green-300">Enviado</span>
                            </div>
                          )}
                          {message.status === "failed" && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 rounded-full border border-red-200 dark:border-red-800 shadow-sm">
                              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                              <span className="text-sm font-bold text-red-700 dark:text-red-300">Falhou</span>
                            </div>
                          )}
                          {message.status === "pending" && (
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-full border border-yellow-200 dark:border-yellow-800 shadow-sm">
                              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                              <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300">Pendente</span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap font-semibold px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                          {new Date(message.sentAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
