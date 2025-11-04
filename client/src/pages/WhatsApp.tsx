import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle, Loader2, Plus, QrCode, Smartphone, Trash2, XCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import QRious from "qrious";
import { Progress } from "@/components/ui/progress";

export default function WhatsApp() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [identification, setIdentification] = useState("");
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "generating" | "waiting" | "connected">("idle");
  const [progress, setProgress] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const utils = trpc.useUtils();
  const { data: connections, isLoading } = trpc.whatsapp.list.useQuery();
  
  const createMutation = trpc.whatsapp.create.useMutation({
    onSuccess: (data) => {
      // Conecta ao WebSocket para receber o QR Code
      setConnectionStatus("generating");
      setProgress(33);
      
      const backendUrl = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:5600";
      const socket = io(backendUrl);
      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("WebSocket conectado");
        setConnectionStatus("waiting");
        setProgress(66);
      });

      socket.on("qrcode", (qrData: { connected: boolean; qrcode?: string }) => {
        if (!qrData.connected && qrData.qrcode && canvasRef.current) {
          // Renderiza o QR Code no canvas
          new QRious({
            element: canvasRef.current,
            value: qrData.qrcode,
            size: 256,
          });
          setConnectionStatus("waiting");
          setProgress(66);
          toast.info("QR Code gerado! Escaneie com seu WhatsApp");
        } else if (qrData.connected) {
          setConnectionStatus("connected");
          setProgress(100);
          toast.success("WhatsApp conectado com sucesso!");
          setTimeout(() => {
            setIsDialogOpen(false);
            setQrCodeData(null);
            setIdentification("");
            setConnectionStatus("idle");
            setProgress(0);
            socket.disconnect();
          }, 2000);
          utils.whatsapp.list.invalidate();
        }
      });

      socket.on("disconnect", () => {
        console.log("WebSocket desconectado");
      });

      socket.on("error", (error: Error) => {
        console.error("Erro no WebSocket:", error);
        toast.error("Erro na conexão com o servidor");
      });
    },
    onError: (error) => {
      toast.error(error.message);
      setIsDialogOpen(false);
      setConnectionStatus("idle");
      setProgress(0);
    },
  });

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const disconnectMutation = trpc.whatsapp.disconnect.useMutation({
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      utils.whatsapp.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.whatsapp.delete.useMutation({
    onSuccess: () => {
      toast.success("Conexão removida");
      utils.whatsapp.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleCreate = () => {
    if (!identification.trim()) {
      toast.error("Digite uma identificação");
      return;
    }
    createMutation.mutate({ identification: identification.trim() });
  };

  const handleDisconnect = (id: number, identification: string) => {
    if (confirm("Deseja realmente desconectar este WhatsApp?")) {
      disconnectMutation.mutate({ id, identification });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Deseja realmente remover esta conexão?")) {
      deleteMutation.mutate({ id });
    }
  };

  // Poll status for connections that are not connected
  useEffect(() => {
    if (!connections) return;
    
    const notConnected = connections.filter(c => c.status !== "connected");
    if (notConnected.length === 0) return;

    const interval = setInterval(() => {
      notConnected.forEach(conn => {
        utils.whatsapp.checkStatus.fetch({ identification: conn.identification });
      });
      utils.whatsapp.list.invalidate();
    }, 5000);

    return () => clearInterval(interval);
  }, [connections, utils]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp</h1>
            <p className="text-gray-600 mt-2">
              Gerencie suas conexões WhatsApp
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conexão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Conectar WhatsApp</DialogTitle>
                <DialogDescription>
                  Digite uma identificação única para esta conexão
                </DialogDescription>
              </DialogHeader>
              {connectionStatus === "idle" ? (
                <>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="identification">Identificação</Label>
                      <Input
                        id="identification"
                        placeholder="Ex: meu-whatsapp"
                        value={identification}
                        onChange={(e) => setIdentification(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleCreate()}
                      />
                      <p className="text-xs text-gray-500">
                        Use apenas letras, números e hífens
                      </p>
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
                      Gerar QR Code
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-6 py-4">
                  {/* Barra de Progresso */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {connectionStatus === "generating" && "Gerando QR Code..."}
                        {connectionStatus === "waiting" && "Aguardando leitura do QR Code"}
                        {connectionStatus === "connected" && "Conectado com sucesso!"}
                      </span>
                      <span className="text-gray-500">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* QR Code */}
                  {connectionStatus === "waiting" && (
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                        <canvas
                          ref={canvasRef}
                          className="w-64 h-64"
                        />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="font-medium text-green-600">Escaneie o QR Code</p>
                        <p className="text-sm text-gray-500">
                          1. Abra o WhatsApp no seu celular
                          <br />
                          2. Toque em Mais opções → Aparelhos conectados
                          <br />
                          3. Toque em Conectar um aparelho
                          <br />
                          4. Aponte seu celular para esta tela
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Loading */}
                  {connectionStatus === "generating" && (
                    <div className="flex flex-col items-center space-y-4 py-8">
                      <Loader2 className="w-12 h-12 animate-spin text-green-600" />
                      <p className="text-sm text-gray-500">Conectando ao servidor...</p>
                    </div>
                  )}

                  {/* Success */}
                  {connectionStatus === "connected" && (
                    <div className="flex flex-col items-center space-y-4 py-8">
                      <CheckCircle className="w-16 h-16 text-green-600" />
                      <p className="text-lg font-medium text-green-600">WhatsApp conectado!</p>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (socketRef.current) {
                          socketRef.current.disconnect();
                        }
                        setIsDialogOpen(false);
                        setQrCodeData(null);
                        setIdentification("");
                        setConnectionStatus("idle");
                        setProgress(0);
                      }}
                      disabled={connectionStatus === "connected"}
                    >
                      Cancelar
                    </Button>
                  </DialogFooter>
                </div>
              )}
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
                      <div className="p-2 bg-green-50 rounded-lg">
                        <Smartphone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {connection.identification}
                        </CardTitle>
                        {connection.phoneNumber && (
                          <CardDescription>{connection.phoneNumber}</CardDescription>
                        )}
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
                      ) : connection.status === "qr_code" ? (
                        <>
                          <QrCode className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">
                            Aguardando QR
                          </span>
                        </>
                      ) : connection.status === "connecting" ? (
                        <>
                          <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
                          <span className="text-sm font-medium text-yellow-600">
                            Conectando
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-600">
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
                        onClick={() => handleDisconnect(connection.id, connection.identification)}
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
              <Smartphone className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma conexão WhatsApp
              </h3>
              <p className="text-gray-500 text-center mb-6">
                Comece adicionando sua primeira conexão WhatsApp
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conexão
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
