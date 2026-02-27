import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { UserPlus, Loader2, Copy, Mail, UserX, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function InviteUsers() {
  const [email, setEmail] = useState("");

  const { data: invitations, isLoading: loadingInvites, refetch: refetchInvites } = trpc.invite.listSent.useQuery();
  const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = trpc.invite.listMembers.useQuery();
  const createMutation = trpc.invite.create.useMutation({
    onSuccess: (data) => {
      toast.success("Convite criado! Copie o link e envie para o e-mail convidado.");
      setEmail("");
      refetchInvites();
      if (data.inviteLink) {
        navigator.clipboard.writeText(data.inviteLink);
        toast.info("Link copiado para a área de transferência.");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeMutation = trpc.invite.revoke.useMutation({
    onSuccess: () => {
      toast.success("Convite revogado.");
      refetchInvites();
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMemberMutation = trpc.invite.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido.");
      refetchMembers();
    },
    onError: (e) => toast.error(e.message),
  });

  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);

  const handleInvite = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Informe o e-mail.");
      return;
    }
    createMutation.mutate({ email: trimmed });
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const pendingInvites = invitations?.filter((i) => i.status === "pending" && new Date(i.expiresAt) > new Date()) ?? [];
  const otherInvites = invitations?.filter((i) => i.status !== "pending" || new Date(i.expiresAt) <= new Date()) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Convidar usuários</h1>
          <p className="text-muted-foreground mt-1">
            Convide pessoas por e-mail. Elas poderão ver suas campanhas e disparos após aceitar o convite.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo convite
            </CardTitle>
            <CardDescription>Informe o e-mail. Um link de convite será gerado para você enviar.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="invite-email">E-mail do convidado</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleInvite} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Convidar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
            <CardDescription>Links ativos. O convidado deve acessar com o mesmo e-mail.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
            ) : (
              <ul className="space-y-3">
                {pendingInvites.map((inv) => {
                  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/aceitar-convite?token=${inv.token}`;
                  return (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 bg-muted/30"
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{inv.email}</span>
                        <Badge variant="outline" className="text-xs">
                          expira {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true, locale: ptBR })}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyLink(link)}>
                          <Copy className="h-4 w-4 mr-1" />
                          Copiar link
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevokeId(inv.id)}>
                          Revogar
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pessoas com acesso</CardTitle>
            <CardDescription>Usuários que aceitaram o convite e podem ver suas campanhas.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !members?.length ? (
              <p className="text-sm text-muted-foreground">Ninguém com acesso ainda.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border p-3 bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{m.memberName || m.memberEmail || `ID ${m.memberId}`}</span>
                      {m.memberEmail && (
                        <span className="text-sm text-muted-foreground">({m.memberEmail})</span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRemoveMemberId(m.memberId)}>
                      <UserX className="h-4 w-4 mr-1" />
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {otherInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de convites</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {otherInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-2 text-muted-foreground">
                    {inv.status === "accepted" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : inv.status === "revoked" || inv.status === "expired" ? (
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{inv.email}</span>
                    <Badge variant="secondary" className="text-xs">
                      {inv.status === "accepted" ? "Aceito" : inv.status === "revoked" ? "Revogado" : "Expirado"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={revokeId !== null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O link deixará de funcionar e o convidado não poderá mais aceitar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (revokeId !== null) {
                  revokeMutation.mutate({ invitationId: revokeId });
                  setRevokeId(null);
                }
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeMemberId !== null} onOpenChange={(open) => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              A pessoa deixará de ver suas campanhas e disparos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => {
                if (removeMemberId !== null) {
                  removeMemberMutation.mutate({ memberId: removeMemberId });
                  setRemoveMemberId(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
