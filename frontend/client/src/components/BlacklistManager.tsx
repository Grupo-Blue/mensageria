import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Plus,
  Trash2,
  Ban,
  UserX,
  Search,
  ShieldX,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface BlacklistManagerProps {
  accountId: number;
  accountName: string;
}

const reasonLabels: Record<string, string> = {
  sair: "SAIR",
  cancelar: "Cancelar Recebimento",
  spam_report: "Denunciado como Spam",
  manual: "Adicionado Manualmente",
  bounce: "Número Inválido/Bounce",
};

const reasonColors: Record<string, string> = {
  sair: "bg-yellow-500/20 text-yellow-600",
  cancelar: "bg-orange-500/20 text-orange-600",
  spam_report: "bg-red-500/20 text-red-600",
  manual: "bg-blue-500/20 text-blue-600",
  bounce: "bg-gray-500/20 text-gray-600",
};

export default function BlacklistManager({ accountId, accountName }: BlacklistManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newReason, setNewReason] = useState<"manual" | "sair" | "cancelar" | "spam_report" | "bounce">("manual");
  const [searchTerm, setSearchTerm] = useState("");

  const utils = trpc.useUtils();

  const { data: blacklist, isLoading, refetch } = trpc.whatsappBusiness.getBlacklist.useQuery(
    { accountId },
    { enabled: !!accountId }
  );

  const addToBlacklistMutation = trpc.whatsappBusiness.addToBlacklist.useMutation({
    onSuccess: (result) => {
      if (result.alreadyBlacklisted) {
        toast.info("Este número já está na blacklist");
      } else {
        toast.success("Número adicionado à blacklist");
      }
      setIsAddDialogOpen(false);
      setNewPhoneNumber("");
      setNewReason("manual");
      utils.whatsappBusiness.getBlacklist.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`Erro ao adicionar: ${error.message}`);
    },
  });

  const removeFromBlacklistMutation = trpc.whatsappBusiness.removeFromBlacklist.useMutation({
    onSuccess: () => {
      toast.success("Número removido da blacklist");
      utils.whatsappBusiness.getBlacklist.invalidate({ accountId });
    },
    onError: (error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  const handleAddToBlacklist = () => {
    if (!newPhoneNumber.trim()) {
      toast.error("Digite o número de telefone");
      return;
    }

    addToBlacklistMutation.mutate({
      accountId,
      phoneNumber: newPhoneNumber.trim(),
      reason: newReason,
    });
  };

  const handleRemoveFromBlacklist = (phoneNumber: string) => {
    removeFromBlacklistMutation.mutate({
      accountId,
      phoneNumber,
    });
  };

  const formatPhone = (phone: string): string => {
    if (phone.length === 13 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    } else if (phone.length === 12 && phone.startsWith("55")) {
      return `+${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  const filteredBlacklist = blacklist?.filter((item) =>
    item.phoneNumber.includes(searchTerm.replace(/\D/g, ""))
  ) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-red-500" />
              Blacklist - {accountName}
            </CardTitle>
            <CardDescription>
              Contatos que não devem receber mensagens desta conta ({filteredBlacklist.length} contatos)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar à Blacklist</DialogTitle>
                  <DialogDescription>
                    Este número não receberá mais mensagens desta conta de WhatsApp Business.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Número de Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="Ex: 5511999999999"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas números, com código do país (55) e DDD
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Motivo</Label>
                    <Select value={newReason} onValueChange={(v) => setNewReason(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Adicionado Manualmente</SelectItem>
                        <SelectItem value="sair">Solicitou SAIR</SelectItem>
                        <SelectItem value="cancelar">Cancelar Recebimento</SelectItem>
                        <SelectItem value="spam_report">Denunciado como Spam</SelectItem>
                        <SelectItem value="bounce">Número Inválido/Bounce</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleAddToBlacklist}
                    disabled={addToBlacklistMutation.isPending}
                  >
                    {addToBlacklistMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="mr-2 h-4 w-4" />
                    )}
                    Bloquear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredBlacklist.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Nenhum número encontrado com esse filtro"
                  : "Nenhum número na blacklist"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {!searchTerm && "Contatos que respondem SAIR são adicionados automaticamente"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBlacklist.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">
                        {formatPhone(item.phoneNumber)}
                      </TableCell>
                      <TableCell>
                        <Badge className={reasonColors[item.reason] || "bg-gray-500/20"}>
                          {reasonLabels[item.reason] || item.reason}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.optedOutAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover da Blacklist?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O número {formatPhone(item.phoneNumber)} poderá receber mensagens
                                novamente. Esta ação não atualiza as listas de contatos
                                automaticamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveFromBlacklist(item.phoneNumber)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Info */}
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">📋 Como funciona a Blacklist:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Contatos são adicionados automaticamente quando respondem "SAIR", "CANCELAR", etc.</li>
              <li>Denúncias de spam também adicionam o contato automaticamente</li>
              <li>Contatos bloqueados não recebem mensagens de campanhas desta conta</li>
              <li>A blacklist é por conta - se um contato sair de uma conta, ainda pode receber de outras</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

