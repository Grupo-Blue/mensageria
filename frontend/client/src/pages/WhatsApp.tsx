import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Loader2, Plus, QrCode, Smartphone, Trash2, Unplug, XCircle, AlertTriangle, Copy, Key, Webhook, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import QRious from "qrious";

/** Segundos até o QR Code ser renovado automaticamente se o backend não reemitir. */
const QR_REFRESH_SECONDS = 45;

type ConnectionRow = {
  id: number;
  identification: string;
  status: string;
  phoneNumber: string | null;
  apiKey: string | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
};

export default function WhatsApp() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnectionDetailsOpen, setIsConnectionDetailsOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<{ id: number; identification: string; apiKey: string | null; webhookUrl: string | null; webhookSecret: string | null } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [identification, setIdentification] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "generating" | "waiting" | "connected">("idle");
  const [progress, setProgress] = useState(0);
  const [qrStalled, setQrStalled] = useState(false);
  const [hasQrCodeRendered, setHasQrCodeRendered] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(QR_REFRESH_SECONDS);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const qrCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();
  const saveConnectionMutation = trpc.whatsapp.saveConnection.useMutation();
  const generateApiKeyMutation = trpc.whatsapp.generateApiKey.useMutation({
    onSuccess: (data) => {
      utils.whatsapp.list.invalidate();
      if (selectedConnection && data.apiKey) {
        setSelectedConnection({ ...selectedConnection, apiKey: data.apiKey });
      }
      toast.success("API Key gerada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao gerar API Key: ${error.message}`);
    },
  });
  const updateWebhookMutation = trpc.whatsapp.updateWebhook.useMutation({
    onSuccess: () => {
      utils.whatsapp.list.invalidate();
      toast.success("Webhook atualizado com sucesso!");
      setIsConnectionDetailsOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });

  /** Limpa todos os timers do fluxo de QR Code. */
  const clearTimers = () => {
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
      qrTimeoutRef.current = null;
    }
    if (qrCountdownRef.current) {
      clearInterval(qrCountdownRef.current);
      qrCountdownRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  /** (Re)inicia o contador de renovação do QR Code. */
  const startQrCountdown = () => {
    if (qrCountdownRef.current) clearInterval(qrCountdownRef.current);
    setQrSecondsLeft(QR_REFRESH_SECONDS);
    qrCountdownRef.current = setInterval(() => {
      setQrSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
  };

  const connectToSocket = async () => {
    setConnectionStatus("generating");
    setProgress(33);
    setQrStalled(false);
    setHasQrCodeRendered(false);
    setConnectedPhone(null);
    clearTimers();

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    // Busca a URL do backend em runtime (compatível com Docker, dev e prod)
    let backendUrl = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3333";
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const cfg = await res.json();
        if (cfg?.backendUrl) backendUrl = cfg.backendUrl;
      }
    } catch {
      console.warn("[WhatsApp] Falha ao obter /api/config, usando fallback:", backendUrl);
    }

    const socket = io(backendUrl, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("requestQRCode", { identification });
      setConnectionStatus("waiting");
      setProgress(66);

      // Se o QR não chegar em 30s, marca a conexão como travada.
      qrTimeoutRef.current = setTimeout(() => {
        setQrStalled(true);
      }, 30000);
    });

    socket.on("connect_error", (error) => {
      toast.error(`Erro ao conectar: ${error.message}`);
    });

    socket.on("qrcode", (qrData: { connected?: boolean; qrcode?: string; id?: string; error?: string }) => {
      if (qrData.error) {
        toast.error(`Erro: ${qrData.error}`);
        return;
      }

      if (qrTimeoutRef.current) {
        clearTimeout(qrTimeoutRef.current);
        qrTimeoutRef.current = null;
      }
      setQrStalled(false);

      // Conexão estabelecida
      if (qrData.connected) {
        clearTimers();
        setConnectionStatus("connected");
        setProgress(100);
        setHasQrCodeRendered(false);
        toast.success("WhatsApp conectado!");

        saveConnectionMutation.mutate(
          { identification },
          { onSuccess: () => utils.whatsapp.list.invalidate() },
        );
        // Busca o número conectado para exibir na tela de sucesso
        utils.whatsapp.checkStatus
          .fetch({ identification })
          .then((r) => {
            if (r?.phoneNumber) setConnectedPhone(r.phoneNumber);
            utils.whatsapp.list.invalidate();
          })
          .catch(() => undefined);

        socket.disconnect();
        // Fecha automaticamente após alguns segundos (o usuário também pode concluir manualmente)
        closeTimerRef.current = setTimeout(() => resetDialog(), 6000);
        return;
      }

      // QR Code recebido — renderiza no canvas
      if (qrData.qrcode) {
        const renderQr = () => {
          const canvas = canvasRef.current;
          if (!canvas || !qrData.qrcode) return false;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          new QRious({ element: canvas, value: qrData.qrcode, size: 256 });
          setConnectionStatus("waiting");
          setProgress(66);
          setHasQrCodeRendered(true);
          startQrCountdown();
          return true;
        };
        // O canvas pode ainda não estar montado — tenta novamente em 100ms
        if (!renderQr()) {
          setTimeout(renderQr, 100);
        }
      }
    });

    socket.on("error", () => {
      toast.error("Erro na conexão com o servidor");
    });
  };

  const handleCreate = () => {
    if (!identification.trim()) {
      toast.error("Digite uma identificação");
      return;
    }
    connectToSocket();
  };

  const handleForceNew = async () => {
    try {
      toast.info("Reiniciando a conexão...");
      const apiToken = import.meta.env.VITE_BACKEND_API_TOKEN;
      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || "https://mensageria.grupoblue.com.br";
      const targetId = identification || "mensageria";
      const response = await fetch(`${backendUrl}/connections/${targetId}/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-api": apiToken || "",
        },
      });
      if (!response.ok) throw new Error("Erro ao reiniciar a conexão");

      toast.success("Gerando novo QR Code...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      connectToSocket();
    } catch {
      toast.error("Erro ao gerar novo QR Code. Tente novamente.");
    }
  };

  /** Gera um novo QR automaticamente quando o atual expira sem renovação do backend. */
  useEffect(() => {
    if (connectionStatus === "waiting" && hasQrCodeRendered && qrSecondsLeft === 0) {
      handleForceNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrSecondsLeft, connectionStatus, hasQrCodeRendered]);

  // Limpa socket e timers ao desmontar
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetDialog = () => {
    if (socketRef.current) socketRef.current.disconnect();
    clearTimers();
    setIsDialogOpen(false);
    setIdentification("");
    setConnectionStatus("idle");
    setProgress(0);
    setQrStalled(false);
    setHasQrCodeRendered(false);
    setConnectedPhone(null);
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
      toast.success("WhatsApp desconectado");
      utils.whatsapp.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Erro ao desconectar: ${error.message}`);
    },
  });

  const handleConnectionClick = (conn: ConnectionRow) => {
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
    <div className="space-y-8">
      {/* Barra de ações — o título da página é do shell (Disparo via WhatsApp). */}
      <div className="flex justify-end items-center">
        <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                resetDialog();
              } else {
                setIsDialogOpen(true);
              }
            }}
          >
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
                  {connectionStatus === "idle"
                    ? "Digite uma identificação única para esta conexão"
                    : connectionStatus === "connected"
                      ? "Conexão estabelecida"
                      : "Escaneie o QR Code com o seu WhatsApp"}
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

              {(connectionStatus === "generating" || connectionStatus === "waiting") && (
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium text-foreground">
                        {connectionStatus === "generating" ? "Gerando QR Code..." : "Aguardando leitura do QR Code"}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full" />
                  </div>

                  {connectionStatus === "generating" && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando ao servidor...
                    </div>
                  )}

                  {connectionStatus === "waiting" && (
                    <>
                      <div className="flex flex-col items-center gap-2 p-4">
                        <div className="relative p-4 bg-secondary/30 rounded-lg elevation-2">
                          <canvas
                            ref={canvasRef}
                            className="border-2 border-primary/20 rounded-lg bg-white"
                          />
                          {!hasQrCodeRendered && (
                            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          )}
                        </div>
                        {hasQrCodeRendered && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            O QR Code é renovado automaticamente em {qrSecondsLeft}s
                          </p>
                        )}
                      </div>

                      <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <h4 className="font-medium text-primary flex items-center gap-2 text-base">
                          <QrCode className="h-5 w-5" />
                          Como escanear
                        </h4>
                        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                          <li>No celular, abra o WhatsApp → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong></li>
                          <li>Aponte a câmera do celular para o QR Code acima</li>
                        </ol>
                      </div>

                      {qrStalled ? (
                        <Alert className="bg-red-50 border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800 text-sm">
                            Não recebemos o QR Code do servidor. Clique em "Gerar Novo QR Code".
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800 text-sm">
                            O QR Code expira rápido — escaneie logo. Um novo é gerado sozinho se necessário.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button variant="outline" onClick={handleForceNew} className="w-full">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Gerar Novo QR Code
                      </Button>
                    </>
                  )}
                </div>
              )}

              {connectionStatus === "connected" && (
                <div className="space-y-4 py-6">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 rounded-full bg-green-100">
                      <CheckCircle className="h-12 w-12 text-green-600" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-lg font-semibold text-foreground">WhatsApp conectado!</p>
                      <p className="text-sm text-muted-foreground">
                        A conexão "{identification}" está pronta para enviar mensagens.
                      </p>
                      {connectedPhone && (
                        <p className="text-sm font-medium text-green-700 mt-1 flex items-center justify-center gap-1">
                          <Smartphone className="h-4 w-4" />
                          {connectedPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2">
                {connectionStatus === "idle" && (
                  <>
                    <Button variant="outline" onClick={resetDialog} className="flex-1 sm:flex-initial">
                      Cancelar
                    </Button>
                    <Button onClick={handleCreate} className="flex-1 sm:flex-initial">
                      Gerar QR Code
                    </Button>
                  </>
                )}
                {(connectionStatus === "generating" || connectionStatus === "waiting") && (
                  <Button variant="outline" onClick={resetDialog} className="w-full sm:w-auto">
                    Cancelar
                  </Button>
                )}
                {connectionStatus === "connected" && (
                  <Button onClick={resetDialog} className="w-full sm:w-auto">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Concluir
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
                Clique em "Nova Conexão" para conectar um WhatsApp lendo o QR Code.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {connections?.map((conn: ConnectionRow) => {
              const isConnected = conn.status === "connected";
              return (
                <Card
                  key={conn.id}
                  className="material-card-elevated hover:elevation-3 transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => handleConnectionClick(conn)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="flex items-center justify-between text-lg gap-2">
                      <span className="truncate font-medium">{conn.identification}</span>
                      {isConnected ? (
                        <Badge className="flex-shrink-0 bg-green-100 text-green-700 hover:bg-green-100 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          Conectado
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex-shrink-0 flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" />
                          Desconectado
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-base flex items-center gap-1">
                      {isConnected && conn.phoneNumber ? (
                        <>
                          <Smartphone className="h-4 w-4" />
                          {conn.phoneNumber}
                        </>
                      ) : isConnected ? (
                        "Conectado e pronto para uso"
                      ) : (
                        "Leia o QR Code para conectar"
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter
                    className="flex justify-end gap-2 p-4 pt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isConnected && (
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon-sm"
                                aria-label="Desconectar"
                                disabled={disconnectMutation.isPending}
                                className="rounded-md shrink-0"
                              >
                                {disconnectMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Unplug className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">Desconectar</TooltipContent>
                        </Tooltip>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desconectar este WhatsApp?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A sessão de "{conn.identification}" será encerrada. Para reconectar
                                será necessário ler o QR Code novamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.stopPropagation();
                                  disconnectMutation.mutate({ id: conn.id, identification: conn.identification });
                                }}
                              >
                                Desconectar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      )}
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon-sm"
                                aria-label="Remover conexão"
                                disabled={deleteMutation.isPending}
                                className="rounded-md shrink-0"
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">Remover</TooltipContent>
                        </Tooltip>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover esta conexão?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A conexão "{conn.identification}" e suas configurações (API Key,
                              webhook) serão removidas permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMutation.mutate({ id: conn.id });
                              }}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </CardFooter>
                </Card>
              );
            })}
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
              {/* API Key */}
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
                    <Button variant="outline" size="sm" onClick={handleCopyApiKey} className="flex-shrink-0">
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

              {/* Webhook */}
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
              <Button onClick={handleSaveWebhook} disabled={updateWebhookMutation.isPending}>
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
  );
}
