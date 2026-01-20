import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  MessageSquare,
  Zap,
  Shield,
  BarChart3,
  Users,
  Webhook,
  Bot,
  ArrowRight,
  Check,
  Mail,
} from "lucide-react";
import { motion } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  const { data: plans, isLoading: loadingPlans } = trpc.billing.getPlans.useQuery();
  const { data: user } = trpc.auth.me.useQuery();

  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Multi-Conexão",
      description:
        "Conecte múltiplas contas de WhatsApp e gerencie todas em um só lugar.",
    },
    {
      icon: Zap,
      title: "API Simples e Poderosa",
      description:
        "Integre facilmente com sua aplicação usando nossa API RESTful.",
    },
    {
      icon: Shield,
      title: "Seguro e Confiável",
      description:
        "Seus dados estão protegidos com criptografia de ponta a ponta.",
    },
    {
      icon: BarChart3,
      title: "Campanhas em Massa",
      description:
        "Envie mensagens para milhares de contatos com templates personalizados.",
    },
    {
      icon: Users,
      title: "Gestão de Contatos",
      description:
        "Organize seus contatos em listas e gerencie opt-outs automaticamente.",
    },
    {
      icon: Webhook,
      title: "Webhooks em Tempo Real",
      description:
        "Receba notificações instantâneas de mensagens recebidas.",
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Mensageria</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm hover:text-primary">
              Recursos
            </a>
            <a href="#pricing" className="text-sm hover:text-primary">
              Preços
            </a>
            <Link href="/terms">
              <a className="text-sm hover:text-primary">Termos</a>
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button>Acessar Painel</Button>
              </Link>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">Entrar</Button>
                </Link>
                <Link href="/dashboard">
                  <Button>Começar Grátis</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge variant="secondary" className="mb-4">
            API de WhatsApp Multitenant
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Automatize seu WhatsApp
            <br />
            de forma profissional
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Plataforma completa para envio de mensagens em massa, gestão de
            múltiplas conexões e integração via API. Perfeito para empresas de
            todos os tamanhos.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2">
                Começar Gratuitamente
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#pricing">
              <Button size="lg" variant="outline">
                Ver Preços
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Tudo que você precisa em um só lugar
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Recursos poderosos para automatizar sua comunicação via WhatsApp
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={item}>
              <Card className="h-full hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Planos para todos os tamanhos
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano ideal para o seu negócio
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
        >
          {loadingPlans ? (
            <div className="col-span-4 text-center py-12">Carregando planos...</div>
          ) : (
            plans?.map((plan: any) => (
              <motion.div key={plan.id} variants={item}>
                <Card
                  className={`h-full relative ${
                    plan.slug === "pro"
                      ? "border-primary shadow-lg scale-105"
                      : ""
                  }`}
                >
                  {plan.slug === "pro" && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Mais Popular
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-4">
                      {plan.isEnterprise ? (
                        <span className="text-2xl font-bold">Sob consulta</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold">
                            {formatCurrency(plan.priceMonthly)}
                          </span>
                          <span className="text-muted-foreground">/mês</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {plan.maxWhatsappConnections === 999999
                          ? "Conexões ilimitadas"
                          : `${plan.maxWhatsappConnections} conexões WhatsApp`}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {plan.maxBusinessAccounts === 0
                          ? "Sem Business API"
                          : `${plan.maxBusinessAccounts} contas Business`}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {plan.maxCampaignsPerMonth === 999999
                          ? "Campanhas ilimitadas"
                          : `${plan.maxCampaignsPerMonth} campanhas/mês`}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {plan.maxMessagesPerMonth >= 100000
                          ? `${(plan.maxMessagesPerMonth / 1000).toFixed(0)}k msgs/mês`
                          : `${plan.maxMessagesPerMonth.toLocaleString()} msgs/mês`}
                      </li>
                      {plan.hasWebhooks && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          Webhooks
                        </li>
                      )}
                      {plan.hasApiAccess && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          Acesso à API
                        </li>
                      )}
                      {plan.hasAiFeatures && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          Recursos de IA
                        </li>
                      )}
                      {plan.hasPrioritySupport && (
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          Suporte Prioritário
                        </li>
                      )}
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
                    ) : (
                      <Link href={user ? "/billing" : "/dashboard"}>
                        <Button
                          className="w-full"
                          variant={plan.slug === "pro" ? "default" : "outline"}
                        >
                          {plan.priceMonthly === 0
                            ? "Começar Grátis"
                            : "Assinar Agora"}
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary to-purple-600 text-white border-0">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
              Crie sua conta gratuita e comece a automatizar suas mensagens de
              WhatsApp em minutos.
            </p>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="gap-2">
                Criar Conta Grátis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
                <span className="font-bold">Mensageria</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Plataforma completa para automação de WhatsApp.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-primary">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-primary">
                    Preços
                  </a>
                </li>
                <li>
                  <Link href="/api">
                    <a className="hover:text-primary">Documentação API</a>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/terms">
                    <a className="hover:text-primary">Termos de Serviço</a>
                  </Link>
                </li>
                <li>
                  <Link href="/privacy">
                    <a className="hover:text-primary">Política de Privacidade</a>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>suporte@exemplo.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Mensageria. Todos os direitos
            reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
