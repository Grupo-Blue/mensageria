import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Bot, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { data: whatsappConnections, isLoading: loadingWhatsapp } = trpc.whatsapp.list.useQuery();
  const { data: telegramConnections, isLoading: loadingTelegram } = trpc.telegram.list.useQuery();
  const { data: messages, isLoading: loadingMessages } = trpc.messages.list.useQuery({ limit: 10 });

  const whatsappConnected = whatsappConnections?.filter(c => c.status === "connected").length || 0;
  const telegramConnected = telegramConnections?.filter(c => c.status === "connected").length || 0;
  const totalMessages = messages?.length || 0;
  const messagesSent = messages?.filter(m => m.status === "sent").length || 0;

  const stats = [
    {
      title: "WhatsApp Conectados",
      value: loadingWhatsapp ? "..." : whatsappConnected,
      total: whatsappConnections?.length || 0,
      icon: MessageSquare,
      color: "text-green-600",
      bgColor: "bg-green-50",
      href: "/whatsapp",
    },
    {
      title: "Telegram Conectados",
      value: loadingTelegram ? "..." : telegramConnected,
      total: telegramConnections?.length || 0,
      icon: Bot,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/telegram",
    },
    {
      title: "Mensagens Enviadas",
      value: loadingMessages ? "..." : messagesSent,
      total: totalMessages,
      icon: Send,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/send",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Visão geral das suas conexões e mensagens
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <a>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-900">
                      {stat.value}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      de {stat.total} total
                    </p>
                  </CardContent>
                </Card>
              </a>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>
              Acesse rapidamente as funcionalidades principais
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
              <Link href="/whatsapp">
                <MessageSquare className="w-5 h-5 mr-3 text-green-600" />
                <div className="text-left">
                  <div className="font-semibold">Conectar WhatsApp</div>
                  <div className="text-sm text-gray-500">Adicionar nova conexão</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
              <Link href="/telegram">
                <Bot className="w-5 h-5 mr-3 text-blue-600" />
                <div className="text-left">
                  <div className="font-semibold">Conectar Telegram</div>
                  <div className="text-sm text-gray-500">Adicionar bot</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
              <Link href="/send">
                <Send className="w-5 h-5 mr-3 text-purple-600" />
                <div className="text-left">
                  <div className="font-semibold">Enviar Mensagem</div>
                  <div className="text-sm text-gray-500">Enviar para WhatsApp ou Telegram</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-4" asChild>
              <Link href="/settings">
                <Clock className="w-5 h-5 mr-3 text-orange-600" />
                <div className="text-left">
                  <div className="font-semibold">Configurações</div>
                  <div className="text-sm text-gray-500">Resumo de grupos e mais</div>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        {messages && messages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Recentes</CardTitle>
              <CardDescription>
                Últimas {messages.length} mensagens enviadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      {message.platform === "whatsapp" ? (
                        <MessageSquare className="w-5 h-5 text-green-600" />
                      ) : (
                        <Bot className="w-5 h-5 text-blue-600" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {message.recipient}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-md">
                          {message.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {message.status === "sent" && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {message.status === "failed" && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      {message.status === "pending" && (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(message.sentAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
