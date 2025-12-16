import DashboardLayout from "@/components/DashboardLayout";
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
import { trpc } from "@/lib/trpc";
import {
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  Building2,
  Key,
  FileText,
  ExternalLink
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WhatsAppBusiness() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: "",
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
  });

  const { data: accounts, isLoading, refetch } = trpc.whatsappBusiness.list.useQuery(undefined, {
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.whatsappBusiness.create.useMutation({
    onSuccess: () => {
      toast.success("Conta adicionada com sucesso!");
      setIsAddDialogOpen(false);
      setNewAccount({ name: "", phoneNumberId: "", businessAccountId: "", accessToken: "" });
      utils.whatsappBusiness.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.whatsappBusiness.delete.useMutation({
    onSuccess: () => {
      toast.success("Conta removida com sucesso!");
      utils.whatsappBusiness.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncTemplatesMutation = trpc.whatsappBusiness.syncTemplates.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} templates sincronizados!`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddAccount = () => {
    if (!newAccount.name || !newAccount.phoneNumberId || !newAccount.businessAccountId || !newAccount.accessToken) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createMutation.mutate(newAccount);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Business API</h1>
            <p className="text-gray-600 mt-2">
              Configure suas contas da API oficial do WhatsApp Business para envio de campanhas de marketing
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Conta WhatsApp Business</DialogTitle>
                <DialogDescription>
                  Conecte sua conta da API oficial do WhatsApp Business (Meta Cloud API)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Conta</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Conta Principal"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                  <Input
                    id="phoneNumberId"
                    placeholder="Ex: 123456789012345"
                    value={newAccount.phoneNumberId}
                    onChange={(e) => setNewAccount({ ...newAccount, phoneNumberId: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Encontre no Meta Business Suite {">"} WhatsApp {">"} API Setup
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAccountId">WhatsApp Business Account ID</Label>
                  <Input
                    id="businessAccountId"
                    placeholder="Ex: 123456789012345"
                    value={newAccount.businessAccountId}
                    onChange={(e) => setNewAccount({ ...newAccount, businessAccountId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Access Token Permanente</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="EAAx..."
                    value={newAccount.accessToken}
                    onChange={(e) => setNewAccount({ ...newAccount, accessToken: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Crie um token permanente em{" "}
                    <a
                      href="https://developers.facebook.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      developers.facebook.com
                    </a>
                  </p>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Como obter as credenciais:
                  </p>
                  <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Acesse o Meta Business Suite</li>
                    <li>Vá em WhatsApp {">"} Configuracoes da API</li>
                    <li>Copie o Phone Number ID e Business Account ID</li>
                    <li>Crie um token permanente no Facebook Developers</li>
                  </ol>
                  <a
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
                  >
                    Ver documentacao completa
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAccount} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Accounts List */}
        {accounts && accounts.length > 0 ? (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onDelete={() => deleteMutation.mutate({ id: account.id })}
                onSyncTemplates={() => syncTemplatesMutation.mutate({ accountId: account.id })}
                isSyncing={syncTemplatesMutation.isPending}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma conta configurada
              </h3>
              <p className="text-gray-500 text-center max-w-md mb-4">
                Adicione sua conta da API oficial do WhatsApp Business para comecar a enviar campanhas de marketing.
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeira Conta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Sobre a API Oficial do WhatsApp Business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Vantagens</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Conta oficial e verificada
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Sem risco de banimento
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Suporte a templates aprovados
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Metricas de entrega e leitura
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Requisitos</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500" />
                    Conta Meta Business verificada
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-blue-500" />
                    Numero de telefone dedicado
                  </li>
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Templates de mensagem aprovados
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Configuracao do Webhook (Status em Tempo Real)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Configure o webhook no Meta Business Suite para receber atualizacoes de status das mensagens (enviada, entregue, lida, falhou).
            </p>

            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">URL do Webhook</p>
                <code className="text-sm bg-white px-2 py-1 rounded border block mt-1 break-all">
                  {window.location.origin}/api/whatsapp-business/webhook
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Token de Verificacao</p>
                <code className="text-sm bg-white px-2 py-1 rounded border block mt-1">
                  mensageria_webhook_token
                </code>
                <p className="text-xs text-gray-500 mt-1">
                  Ou defina WHATSAPP_WEBHOOK_VERIFY_TOKEN no .env
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Como configurar no Meta:</p>
              <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse o Meta for Developers (developers.facebook.com)</li>
                <li>Selecione seu App {">"} WhatsApp {">"} Configuracao</li>
                <li>Em "Webhook", clique em "Editar"</li>
                <li>Cole a URL do webhook e o token de verificacao</li>
                <li>Selecione os campos: messages, message_echoes</li>
                <li>Clique em "Verificar e Salvar"</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface AccountCardProps {
  account: {
    id: number;
    name: string;
    phoneNumberId: string;
    businessAccountId: string;
    isActive: boolean;
    createdAt: Date;
  };
  onDelete: () => void;
  onSyncTemplates: () => void;
  isSyncing: boolean;
  isDeleting: boolean;
}

function AccountCard({ account, onDelete, onSyncTemplates, isSyncing, isDeleting }: AccountCardProps) {
  const { data: phoneInfo, isLoading: isLoadingPhone } = trpc.whatsappBusiness.getPhoneInfo.useQuery(
    { accountId: account.id },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  const { data: templates } = trpc.whatsappBusiness.getTemplates.useQuery(
    { accountId: account.id },
    {
      refetchInterval: false,
      refetchOnWindowFocus: false,
    }
  );

  const approvedTemplates = templates?.filter((t) => t.status === "APPROVED") || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {account.name}
              <Badge variant={account.isActive ? "default" : "secondary"}>
                {account.isActive ? "Ativa" : "Inativa"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Phone Number ID: {account.phoneNumberId}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncTemplates}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Sincronizar Templates</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acao ira remover a conta "{account.name}" e todos os templates sincronizados.
                    Campanhas existentes nao serao afetadas.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Removendo..." : "Remover"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Phone Info */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Telefone</p>
            {isLoadingPhone ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : phoneInfo ? (
              <div>
                <p className="text-sm font-medium">{phoneInfo.display_phone_number}</p>
                <p className="text-xs text-gray-500">{phoneInfo.verified_name}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Quality Rating */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Qualidade</p>
            {phoneInfo?.quality_rating ? (
              <Badge
                variant={
                  phoneInfo.quality_rating === "GREEN"
                    ? "default"
                    : phoneInfo.quality_rating === "YELLOW"
                    ? "secondary"
                    : "destructive"
                }
              >
                {phoneInfo.quality_rating}
              </Badge>
            ) : (
              <p className="text-sm text-gray-500">-</p>
            )}
          </div>

          {/* Templates */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase">Templates Aprovados</p>
            <p className="text-sm font-medium">
              {approvedTemplates.length} template{approvedTemplates.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Templates Preview */}
        {approvedTemplates.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Templates Disponiveis</p>
            <div className="flex flex-wrap gap-2">
              {approvedTemplates.slice(0, 5).map((template) => (
                <Badge key={template.id} variant="outline" className="text-xs">
                  {template.name} ({template.language})
                </Badge>
              ))}
              {approvedTemplates.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{approvedTemplates.length - 5} mais
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
