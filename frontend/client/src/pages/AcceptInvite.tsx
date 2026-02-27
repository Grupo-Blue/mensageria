import { useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { Loader2, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AcceptInvite() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token") ?? "";

  const { user, loading: authLoading } = useAuth();
  const { data: inviteInfo, isLoading: loadingInvite } = trpc.invite.getByToken.useQuery(
    { token },
    { enabled: !!token.trim() }
  );

  const acceptMutation = trpc.invite.accept.useMutation({
    onSuccess: (data) => {
      if (data.alreadyMember) {
        toast.success("Você já tem acesso aos disparos deste usuário.");
      } else {
        toast.success("Convite aceito! Agora você pode ver as campanhas na lista.");
      }
      setAccepted(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const [accepted, setAccepted] = useState(false);

  if (!token.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>Este link de convite está incompleto ou inválido.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/">Ir para o início</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!inviteInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Convite inválido ou expirado</CardTitle>
            <CardDescription>
              Este link já foi usado, foi revogado ou expirou. Peça um novo convite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/">Ir para o início</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <UserCheck className="h-6 w-6" />
              Convite aceito
            </CardTitle>
            <CardDescription>
              Você já pode ver as campanhas e disparos de {inviteInfo.inviterName} em Campanhas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href="/campaigns">Ver campanhas</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Você foi convidado</CardTitle>
            <CardDescription>
              <strong>{inviteInfo.inviterName}</strong> convidou você para ver os disparos. O convite é para o e-mail{" "}
              <strong>{inviteInfo.email}</strong>. Faça login com esse e-mail para aceitar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>Fazer login para aceitar</a>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <a href="/">Ir para o início</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>
            <strong>{inviteInfo.inviterName}</strong> convidou você para ver as campanhas e disparos. O convite foi enviado
            para <strong>{inviteInfo.email}</strong>. Você está logado como {user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            className="w-full"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate({ token })}
          >
            {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Aceitar convite
          </Button>
          <Button variant="outline" asChild className="w-full">
            <a href="/campaigns">Cancelar e ir para campanhas</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
