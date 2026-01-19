import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Loader2, Plus, QrCode, Smartphone, Trash2, XCircle, AlertTriangle, Copy, Key, Webhook } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import QRious from "qrious";
import { Progress } from "@/components/ui/progress";

export default function WhatsApp() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnectionDetailsOpen, setIsConnectionDetailsOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<{ id: number; identification: string; apiKey: string | null; webhookUrl: string | null; webhookSecret: string | null } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [identification, setIdentification] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "generating" | "waiting" | "connected">("idle");
  const [progress, setProgress] = useState(0);
  const [qrCodeTimeout, setQrCodeTimeout] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();
  const saveConnectionMutation = trpc.whatsapp.saveConnection.useMutation();
  const generateApiKeyMutation = trpc.whatsapp.generateApiKey.useMutation({
    onSuccess: (data) => {
      console.log("[WhatsApp] API Key gerada com sucesso:", data);
      utils.whatsapp.list.invalidate();
      if (selectedConnection && data.apiKey) {
        setSelectedConnection({
          ...selectedConnection,
          apiKey: data.apiKey,
        });
      }
      toast.success("API Key gerada com sucesso!");
    },
    onError: (error) => {
      console.error("[WhatsApp] Erro ao gerar API Key:", error);
      toast.error(`Erro ao gerar API Key: ${error.message}`);
    },
  });
  const updateWebhookMutation = trpc.whatsapp.updateWebhook.useMutation({
    onSuccess: () => {
      console.log("[WhatsApp] Webhook atualizado com sucesso");
      utils.whatsapp.list.invalidate();
      toast.success("Webhook atualizado com sucesso!");
      setIsConnectionDetailsOpen(false);
    },
    onError: (error) => {
      console.error("[WhatsApp] Erro ao atualizar webhook:", error);
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });

  const connectToSocket = (forceNew: boolean = false) => {
    console.log("[WhatsApp] connectToSocket chamado - identification:", identification);
    setConnectionStatus("generating");
    setProgress(33);
    setQrCodeTimeout(false);
    
    // Limpa timeout anterior se existir
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
    }
    
    // Desconecta socket anterior se existir
    if (socketRef.current) {
      console.log("[WhatsApp] Desconectando socket anterior");
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    
    // Conecta ao Socket.IO - usa variável de ambiente ou localhost em desenvolvimento
    const backendUrl = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3333";
    console.log("[WhatsApp] Connecting to Socket.IO at:", backendUrl);
    console.log("[WhatsApp] Socket.IO path:", "/socket.io");
    
    const socket = io(backendUrl, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WhatsApp] Socket.IO conectado! Socket ID:", socket.id);
      console.log("[WhatsApp] Emitindo requestQRCode com identification:", identification);
      
      // Solicita QR Code ao backend com callback para confirmar recebimento
      socket.emit("requestQRCode", { identification }, (response: any) => {
        if (response) {
          console.log("[WhatsApp] ✅ Backend confirmou recebimento do requestQRCode:", response);
        } else {
          console.log("[WhatsApp] ⚠️ Backend não retornou acknowledgment (pode ser normal)");
        }
      });
      
      // Log adicional para debug
      console.log("[WhatsApp] 📤 Evento requestQRCode emitido, aguardando resposta...");
      
      setConnectionStatus("waiting");
      setProgress(66);
      
      // Timeout aumentado para 30 segundos (Baileys pode demorar para gerar QR, especialmente após logout)
      qrTimeoutRef.current = setTimeout(() => {
        console.warn("[WhatsApp] ⚠️ TIMEOUT: QR Code não recebido em 30 segundos");
        console.warn("[WhatsApp] Verifique os logs do backend para ver se o QR foi gerado");
        console.warn("[WhatsApp] Socket ainda conectado?", socket.connected);
        setQrCodeTimeout(true);
        toast.warning("QR Code não recebido após 30 segundos. Verifique os logs do backend.");
      }, 30000);
    });

    socket.on("connect_error", (error) => {
      console.error("[WhatsApp] Erro ao conectar Socket.IO:", error);
      console.error("[WhatsApp] Error message:", error.message);
      toast.error(`Erro ao conectar: ${error.message}`);
    });
    


    socket.on("qrcode", (qrData: { connected?: boolean; qrcode?: string; id?: string; error?: string }) => {
      console.log("[WhatsApp] 🔔 Evento 'qrcode' recebido!");
      console.log("[WhatsApp] Dados recebidos:", JSON.stringify(qrData, null, 2));
      console.log("[WhatsApp] qrData.connected:", qrData.connected);
      console.log("[WhatsApp] qrData.qrcode presente:", !!qrData.qrcode);
      console.log("[WhatsApp] qrData.qrcode length:", qrData.qrcode?.length || 0);
      console.log("[WhatsApp] canvasRef.current existe:", !!canvasRef.current);
      console.log("[WhatsApp] connectionStatus atual:", connectionStatus);
      
      // Verificar se há erro
      if (qrData.error) {
        console.error("[WhatsApp] ❌ Erro recebido no evento qrcode:", qrData.error);
        toast.error(`Erro: ${qrData.error}`);
        return;
      }
      
      // Limpa o timeout pois recebemos resposta
      if (qrTimeoutRef.current) {
        console.log("[WhatsApp] ✅ Limpando timeout");
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }
      setQrCodeTimeout(false);
      
      // Verificar condições para renderizar QR code
      const hasQrCode = !qrData.connected && qrData.qrcode;
      const hasCanvas = !!canvasRef.current;
      
      console.log("[WhatsApp] Condições para renderizar:");
      console.log("  - hasQrCode:", hasQrCode);
      console.log("  - hasCanvas:", hasCanvas);
      console.log("  - qrData.connected:", qrData.connected);
      
      if (hasQrCode && hasCanvas) {
        console.log("[WhatsApp] ✅ Renderizando QR Code no canvas");
        try {
          // Limpar canvas anterior se existir
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          
          // Renderiza o QR Code no canvas
          new QRious({
            element: canvasRef.current,
            value: qrData.qrcode,
            size: 256,
          });
          console.log("[WhatsApp] ✅ QR Code renderizado com sucesso!");
          setConnectionStatus("waiting");
          setProgress(66);
          toast.info("QR Code gerado! Escaneie com seu WhatsApp");
        } catch (error: any) {
          console.error("[WhatsApp] ❌ Erro ao renderizar QR Code:", error);
          console.error("[WhatsApp] Stack:", error.stack);
          toast.error("Erro ao renderizar QR Code: " + error.message);
        }
      } else if (hasQrCode && !hasCanvas) {
        console.warn("[WhatsApp] ⚠️ QR Code recebido mas canvas não está disponível ainda");
        console.warn("[WhatsApp] Tentando novamente em 100ms...");
        setTimeout(() => {
          if (canvasRef.current && qrData.qrcode) {
            console.log("[WhatsApp] Tentando renderizar novamente...");
            new QRious({
              element: canvasRef.current,
              value: qrData.qrcode,
              size: 256,
            });
            setConnectionStatus("waiting");
            setProgress(66);
            toast.info("QR Code gerado! Escaneie com seu WhatsApp");
          }
        }, 100);
      } else if (qrData.connected) {
        console.log("[WhatsApp] Conexão estabelecida (connected: true)");
        setConnectionStatus("connected");
        setProgress(100);
        toast.success("WhatsApp conectado com sucesso!");
        
        // Salva a conexão no banco de dados
        saveConnectionMutation.mutate(
          { identification },
          {
            onSuccess: () => {
              utils.whatsapp.list.invalidate();
              toast.success("Conexão salva com sucesso!");
            },
            onError: (error) => {
              console.error("Erro ao salvar conexão:", error);
              toast.error("Erro ao salvar conexão: " + (error as any).message);
            }
          }
        );
        
        setTimeout(() => {
          setIsDialogOpen(false);
          setIdentification("");
          setConnectionStatus("idle");
          setProgress(0);
          socket.disconnect();
        }, 2000);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[WhatsApp] Socket.IO desconectado. Motivo:", reason);
    });

    socket.on("error", (error) => {
      console.error("[WhatsApp] Erro no Socket.IO:", error);
      toast.error("Erro na conexão com o servidor");
    });

    // Log todos os eventos para debug
    const originalOnevent = socket.onevent;
    socket.onevent = function (packet) {
      const args = packet.data || [];
      console.log("[WhatsApp] 📡 Socket.IO evento recebido:", args[0], args.slice(1));
      originalOnevent.call(this, packet);
    };

    // Verificar se o socket está realmente conectado após 2 segundos
    setTimeout(() => {
      console.log("[WhatsApp] Status do socket após 2s - connected:", socket.connected);
      console.log("[WhatsApp] Status do socket após 2s - disconnected:", socket.disconnected);
      console.log("[WhatsApp] Socket ID atual:", socket.id);
    }, 2000);
  };

  const handleCreate = () => {
    if (!identification.trim()) {
      toast.error("Digite uma identificação");
      return;
    }
    connectToSocket(false);
  };

  const handleForceNew = async () => {
    try {
      toast.info("Fazendo logout completo...");
      
      // Chama endpoint REST do backend para fazer logout completo (remove sessão)
      const apiToken = import.meta.env.VITE_BACKEND_API_TOKEN;
      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || "https://mensageria.grupoblue.com.br";
      const targetId = identification || "mensageria";
      const response = await fetch(`${backendUrl}/connections/${targetId}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-api": apiToken || ""
        }
      });
      
      if (!response.ok) {
        throw new Error("Erro ao fazer logout");
      }
      
      toast.success("Sessão removida! Gerando novo QR Code...");
      
      // Aguarda 1 segundo para garantir que o backend processou o logout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Agora solicita novo QR Code
      connectToSocket(true);
    } catch (error) {
      toast.error("Erro ao fazer logout. Tente novamente.");
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
      }
    };
  }, []);

  const handleCancel = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
    }
    setIsDialogOpen(false);
    setIdentification("");
    setConnectionStatus("idle");
    setProgress(0);
    setQrCodeTimeout(false);
  };

  const deleteMutation = trpc.whatsapp.delete.useMutation({
    onSuccess: () => {
      toast.success("Conexão removida");
      utils.whatsapp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const disconnectMutation = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Desconectado");
      utils.whatsapp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  const handleConnectionClick = (conn: any) => {
    setSelectedConnection({
      id: conn.id,
      identification: conn.identification,
      apiKey: conn.apiKey || null,
      webhookUrl: conn.webhookUrl || null,
      webhookSecret: conn.webhookSecret || null,
    });
    setWebhookUrl(conn.webhookUrl || "");
    setWebhookSecret(conn.webhookSecret || "");
    setIsConnectionDetailsOpen(true);
  };

  const handleCopyApiKey = async () => {
    if (selectedConnection?.apiKey) {
      await navigator.clipboard.writeText(selectedConnection.apiKey);
      toast.success("API Key copiada!");
    }
  };

  const handleGenerateApiKey = () => {
    if (selectedConnection) {
      generateApiKeyMutation.mutate({ connectionId: selectedConnection.id });
    }
  };

  const handleSaveWebhook = () => {
    if (selectedConnection) {
      // Validação: se webhookUrl está preenchido, deve ser uma URL válida
      if (webhookUrl && !webhookUrl.match(/^https?:\/\/.+/)) {
        toast.error("URL do webhook deve começar com http:// ou https://");
        return;
      }
      
      updateWebhookMutation.mutate({
        connectionId: selectedConnection.id,
        webhookUrl: webhookUrl.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-medium text-foreground mb-2">WhatsApp</h1>
          <p className="text-muted-foreground text-base">Gerencie suas conexões WhatsApp</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card">
            <DialogHeader>
              <DialogTitle className="text-xl font-medium">Conectar WhatsApp</DialogTitle>
              <DialogDescription className="text-base">
                Digite uma identificação única para esta conexão
              </DialogDescription>
            </DialogHeader>

            {connectionStatus === "idle" && (
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <Label htmlFor="identification" className="text-base font-medium">Identificação</Label>
                  <Input
                    id="identification"
                    placeholder="Ex: meu-whatsapp"
                    value={identification}
                    onChange={(e) => setIdentification(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-sm text-muted-foreground">
                    Use apenas letras, números e hífens
                  </p>
                </div>
              </div>
            )}

            {(connectionStatus === "generating" || connectionStatus === "waiting" || connectionStatus === "connected") && (
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-medium text-foreground">
                      {connectionStatus === "generating" && "Gerando QR Code..."}
                      {connectionStatus === "waiting" && "Aguardando leitura do QR Code"}
                      {connectionStatus === "connected" && "Conectado com sucesso!"}
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3 rounded-full" />
                </div>

                {connectionStatus === "waiting" && (
                  <>
                    <div className="flex justify-center p-4">
                      <div className="relative p-4 bg-secondary/30 rounded-lg elevation-2">
                        <canvas
                          ref={canvasRef}
                          className="border-2 border-primary/20 rounded-lg bg-white"
                        />
                        {!canvasRef.current?.toDataURL() && (
                          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                      <h4 className="font-medium text-primary flex items-center gap-2 text-base">
                        <QrCode className="h-5 w-5" />
                        Escaneie o QR Code
                      </h4>
                      <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Abra o WhatsApp no seu celular</li>
                        <li>Toque em Mais opções → Aparelhos conectados</li>
                        <li>Toque em Conectar um aparelho</li>
                        <li>Aponte seu celular para esta tela</li>
                      </ol>
                    </div>
                    
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-sm">
                        Se o QR Code não aparecer, clique em "Forçar Novo QR Code" para reiniciar a conexão.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      variant="outline" 
                      onClick={handleForceNew}
                      className="w-full"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Forçar Novo QR Code
                    </Button>
                  </>
                )}

                {connectionStatus === "connected" && (
                  <Alert className="bg-green-50 border-green-300 elevation-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertDescription className="text-green-800 font-medium">
                      WhatsApp conectado com sucesso! Fechando...
                    </AlertDescription>
                  </Alert>
                )}

                {connectionStatus === "generating" && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Conectando ao servidor...
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2">
                {connectionStatus === "idle" ? (
                  <>
                    <Button variant="outline" onClick={handleCancel} className="flex-1 sm:flex-initial">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} className="flex-1 sm:flex-initial">
                      Gerar QR Code
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                )}
              </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {connections && connections.length === 0 ? (
        <Card className="material-card-elevated">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-primary/10 mb-6">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">Nenhuma conexão configurada</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Nenhuma conexão WhatsApp configurada.
              <br />
              Clique em "Nova Conexão" para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {connections?.map((conn) => (
            <Card 
              key={conn.id} 
              className="material-card-elevated hover:elevation-3 transition-all duration-300 cursor-pointer"
              onClick={() => handleConnectionClick(conn)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="truncate font-medium">{conn.identification}</span>
                  {conn.status === 'connected' ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )}
                </CardTitle>
                <CardDescription className="text-base">
                  {conn.status === 'connected' ? "Conectado e pronto para uso" : "Desconectado"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {conn.status === 'connected' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectMutation.mutate({ id: conn.id, identification: conn.identification });
                      }}
                      disabled={disconnectMutation.isPending}
                      className="flex-1"
                    >
                      {disconnectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Desconectar"
                      )}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate({ id: conn.id });
                    }}
                    disabled={deleteMutation.isPending}
                    className="flex-1"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Detalhes da Conexão */}
      <Dialog open={isConnectionDetailsOpen} onOpenChange={setIsConnectionDetailsOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium flex items-center gap-2">
              <Key className="h-5 w-5" />
              Configurações da Conexão
            </DialogTitle>
            <DialogDescription className="text-base">
              {selectedConnection?.identification}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* API Key Section */}
            <div className="space-y-3">
              <Label htmlFor="apiKey" className="text-base font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  value={selectedConnection?.apiKey || "Não configurada"}
                  readOnly
                  className="flex-1 font-mono text-sm bg-muted"
                />
                {selectedConnection?.apiKey ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyApiKey}
                    className="flex-shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateApiKey}
                    disabled={generateApiKeyMutation.isPending}
                    className="flex-shrink-0"
                  >
                    {generateApiKeyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Gerar"
                    )}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Use esta API Key para autenticar suas requisições à API
              </p>
            </div>

            {/* Webhook Section */}
            <div className="space-y-3">
              <Label htmlFor="webhookUrl" className="text-base font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhook URL
              </Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://seu-servidor.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                URL que receberá os eventos desta conexão
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="webhookSecret" className="text-base font-medium">
                Webhook Secret
              </Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Seu secret para validar o webhook"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Secret usado para validar requisições do webhook
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsConnectionDetailsOpen(false)}>
              Fechar
            </Button>
            <Button 
              onClick={handleSaveWebhook}
              disabled={updateWebhookMutation.isPending}
            >
              {updateWebhookMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Webhook"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}
