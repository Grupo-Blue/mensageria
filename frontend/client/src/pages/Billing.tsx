import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  CreditCard,
  Check,
  ExternalLink,
  Mail,
  ArrowUpCircle,
  Calendar,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function Billing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: subscription, isLoading: loadingSubscription } =
    trpc.billing.getCurrentSubscription.useQuery();
  const { data: usage, isLoading: loadingUsage } = trpc.billing.getUsage.useQuery();
  const { data: plans, isLoading: loadingPlans } = trpc.billing.getPlans.useQuery();
  const { data: paymentHistory } = trpc.billing.getPaymentHistory.useQuery({
    limit: 10,
    offset: 0,
  });

  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const currentPlan = subscription?.plan;
  const isFreePlan = subscription?.isFreePlan;

  const getUsagePercentage = (current: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  return (
    <DashboardLayout
      title="Billing & Planos"
      description="Gerencie sua assinatura e uso"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Plano Atual
                  <Badge variant={isFreePlan ? "secondary" : "default"}>
                    {currentPlan?.name || "Free"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {subscription?.subscription?.currentPeriodEnd
                    ? `Renova em ${formatDate(subscription.subscription.currentPeriodEnd)}`
                    : "Plano gratuito"}
                </CardDescription>
              </div>
              {!isFreePlan && subscription?.subscription?.stripeCustomerId && (
                <Button
                  variant="outline"
                  onClick={() => portalMutation.mutate({})}
                  disabled={portalMutation.isPending}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Gerenciar no Stripe
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conexões WhatsApp</span>
                  <span className="font-medium">
                    {usage?.current?.whatsappConnections || 0}/
                    {usage?.limits?.maxWhatsappConnections || 0}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage?.current?.whatsappConnections || 0,
                    usage?.limits?.maxWhatsappConnections || 1
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Contas Business</span>
                  <span className="font-medium">
                    {usage?.current?.businessAccounts || 0}/
                    {usage?.limits?.maxBusinessAccounts || 0}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage?.current?.businessAccounts || 0,
                    usage?.limits?.maxBusinessAccounts || 1
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Campanhas (mês)</span>
                  <span className="font-medium">
                    {usage?.current?.campaignsCreated || 0}/
                    {usage?.limits?.maxCampaignsPerMonth || 0}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    usage?.current?.campaignsCreated || 0,
                    usage?.limits?.maxCampaignsPerMonth || 1
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mensagens (mês)</span>
                  <span className="font-medium">
                    {(usage?.current?.messagesViaApi || 0) +
                      (usage?.current?.messagesViaTemplate || 0)}
                    /{usage?.limits?.maxMessagesPerMonth || 0}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    (usage?.current?.messagesViaApi || 0) +
                      (usage?.current?.messagesViaTemplate || 0),
                    usage?.limits?.maxMessagesPerMonth || 1
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Planos Disponíveis</CardTitle>
            <CardDescription>
              Escolha o plano ideal para o seu negócio
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center mb-8">
              <Tabs
                value={billingCycle}
                onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}
              >
                <TabsList>
                  <TabsTrigger value="monthly">Mensal</TabsTrigger>
                  <TabsTrigger value="yearly">
                    Anual
                    <Badge variant="secondary" className="ml-2">
                      -17%
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {loadingPlans ? (
                <div className="col-span-4 text-center py-8">
                  Carregando planos...
                </div>
              ) : (
                plans?.map((plan: any) => {
                  const isCurrentPlan = currentPlan?.slug === plan.slug;
                  const price =
                    billingCycle === "yearly" && plan.priceYearly
                      ? plan.priceYearly / 12
                      : plan.priceMonthly;

                  return (
                    <Card
                      key={plan.id}
                      className={`relative ${
                        isCurrentPlan ? "border-primary" : ""
                      } ${plan.slug === "pro" ? "shadow-lg" : ""}`}
                    >
                      {isCurrentPlan && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                          Plano Atual
                        </Badge>
                      )}
                      <CardHeader className="text-center pb-2">
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription className="min-h-[40px]">
                          {plan.description}
                        </CardDescription>
                        <div className="pt-4">
                          {plan.isEnterprise ? (
                            <span className="text-2xl font-bold">Sob consulta</span>
                          ) : (
                            <>
                              <span className="text-3xl font-bold">
                                {formatCurrency(price)}
                              </span>
                              <span className="text-muted-foreground">/mês</span>
                            </>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {plan.maxWhatsappConnections >= 999999
                              ? "Conexões ilimitadas"
                              : `${plan.maxWhatsappConnections} conexões`}
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {plan.maxBusinessAccounts === 0
                              ? "Sem Business API"
                              : `${plan.maxBusinessAccounts} contas Business`}
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {plan.maxCampaignsPerMonth >= 999999
                              ? "Campanhas ilimitadas"
                              : `${plan.maxCampaignsPerMonth} campanhas/mês`}
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-500" />
                            {plan.maxMessagesPerMonth >= 100000
                              ? `${(plan.maxMessagesPerMonth / 1000).toFixed(0)}k msgs/mês`
                              : `${plan.maxMessagesPerMonth.toLocaleString()} msgs/mês`}
                          </li>
                        </ul>

                        {plan.isEnterprise ? (
                          <Button
                            className="w-full"
                            variant="outline"
                            onClick={() => {
                              window.location.href = `mailto:comercial@exemplo.com?subject=Interesse no Plano Enterprise`;
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Fale Conosco
                          </Button>
                        ) : isCurrentPlan ? (
                          <Button className="w-full" variant="outline" disabled>
                            Plano Atual
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            variant={plan.slug === "pro" ? "default" : "outline"}
                            onClick={() =>
                              checkoutMutation.mutate({
                                planSlug: plan.slug,
                                billingCycle,
                              })
                            }
                            disabled={checkoutMutation.isPending}
                          >
                            {plan.priceMonthly === 0 ? (
                              "Usar Grátis"
                            ) : (
                              <>
                                <ArrowUpCircle className="h-4 w-4 mr-2" />
                                Upgrade
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        {paymentHistory && paymentHistory.payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Pagamentos</CardTitle>
              <CardDescription>Seus últimos pagamentos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentHistory.payments.map((payment: any) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          payment.status === "succeeded"
                            ? "bg-green-100 text-green-600"
                            : payment.status === "failed"
                              ? "bg-red-100 text-red-600"
                              : "bg-yellow-100 text-yellow-600"
                        }`}
                      >
                        <CreditCard className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        payment.status === "succeeded"
                          ? "default"
                          : payment.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {payment.status === "succeeded"
                        ? "Pago"
                        : payment.status === "failed"
                          ? "Falhou"
                          : payment.status === "refunded"
                            ? "Reembolsado"
                            : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
