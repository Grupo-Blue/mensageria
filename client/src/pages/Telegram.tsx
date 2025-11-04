import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Bot, CheckCircle, Loader2, Plus, Trash2, XCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Telegram() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [botToken, setBotToken] = useState("");

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.telegram.list.useQuery();
  
  const createMutation = trpc.telegram.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Bot @${data.username} conectado com sucesso!`);
      setIsDialogOpen(false);
      setBotToken("");
      utils.telegram.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = trpc.telegram.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Bot desconectado");
      utils.telegram.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.telegram.delete.useMutation({
    onSuccess: () => {
      toast.success("Bot removido");
      utils.telegram.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    if (!botToken.trim()) {
      toast.error("Digite o token do bot");
      return;
    }
    createMutation.mutate({ botToken: botToken.trim() });
  };

  const handleDisconnect = (id: number) => {
    if (confirm("Deseja realmente desconectar este bot?")) {
      disconnectMutation.mutate({ id });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Deseja realmente remover este bot?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Telegram</h1>
            <p className="text-gray-600 mt-2">
              Gerencie seus bots do Telegram
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Bot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Conectar Bot Telegram</DialogTitle>
                <DialogDescription>
                  Adicione o token do seu bot do Telegram
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="botToken">Token do Bot</Label>
                  <Input
                    id="botToken"
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreate()}
                  />
                  <p className="text-xs text-gray-500">
                    Obtenha o token conversando com o @BotFather no Telegram
                  </p>
                </div>
                
                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-blue-900">
                    Como criar um bot:
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Abra o Telegram e procure por @BotFather</li>
                    <li>Envie o comando /newbot</li>
                    <li>Escolha um nome e username para o bot</li>
                    <li>Copie o token fornecido</li>
                  </ol>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Abrir @BotFather
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Conectar Bot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connections List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : connections && connections.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Bot className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          @{connection.botUsername || "Bot"}
                        </CardTitle>
                        <CardDescription className="text-xs truncate max-w-[150px]">
                          {connection.botToken.substring(0, 20)}...
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <div className="flex items-center space-x-2">
                      {connection.status === "connected" ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">
                            Conectado
                          </span>
                        </>
                      ) : connection.status === "error" ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-600">
                            Erro
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-600">
                            Desconectado
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Last Connected */}
                  {connection.lastConnectedAt && (
                    <div className="text-xs text-gray-500">
                      Última conexão:{" "}
                      {new Date(connection.lastConnectedAt).toLocaleString("pt-BR")}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2">
                    {connection.status === "connected" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnectMutation.isPending}
                      >
                        Desconectar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(connection.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Bot className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum bot Telegram
              </h3>
              <p className="text-gray-500 text-center mb-6">
                Comece adicionando seu primeiro bot do Telegram
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Bot
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
