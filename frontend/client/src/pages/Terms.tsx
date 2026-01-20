import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Mensageria</span>
            </a>
          </Link>
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Termos de Serviço</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <h2>1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e usar a plataforma Mensageria ("Serviço"), você concorda
            em cumprir e estar vinculado a estes Termos de Serviço. Se você não
            concordar com qualquer parte destes termos, não poderá acessar o
            Serviço.
          </p>

          <h2>2. Descrição do Serviço</h2>
          <p>
            O Mensageria é uma plataforma de automação de mensagens que permite:
          </p>
          <ul>
            <li>Conexão de múltiplas contas WhatsApp para envio e recebimento de mensagens</li>
            <li>Integração com a API oficial do WhatsApp Business</li>
            <li>Envio de campanhas de mensagens em massa</li>
            <li>Gestão de contatos e listas</li>
            <li>Configuração de webhooks para integração com sistemas externos</li>
            <li>Acesso via API para automação</li>
          </ul>

          <h2>3. Uso Aceitável</h2>
          <p>Você concorda em usar o Serviço apenas para fins legais. É expressamente proibido:</p>
          <ul>
            <li>Enviar spam ou mensagens não solicitadas</li>
            <li>Distribuir conteúdo ilegal, ofensivo ou que viole direitos de terceiros</li>
            <li>Tentar acessar contas de outros usuários</li>
            <li>Usar o Serviço para atividades fraudulentas</li>
            <li>Violar os Termos de Serviço do WhatsApp ou Meta</li>
            <li>Coletar dados pessoais de terceiros sem consentimento</li>
            <li>Enviar mensagens que contenham malware ou links maliciosos</li>
          </ul>

          <h2>4. Contas WhatsApp</h2>
          <p>
            <strong>Importante:</strong> O uso do Serviço com a API não oficial do
            WhatsApp (via Baileys) pode resultar no banimento da sua conta
            WhatsApp pela Meta. Não nos responsabilizamos por:
          </p>
          <ul>
            <li>Banimento ou suspensão de contas WhatsApp</li>
            <li>Perda de dados ou mensagens</li>
            <li>Interrupções no serviço causadas pelo WhatsApp</li>
          </ul>
          <p>
            Recomendamos o uso da API oficial do WhatsApp Business para uso
            comercial intensivo.
          </p>

          <h2>5. Pagamentos e Assinaturas</h2>
          <p>
            Os planos pagos são cobrados de forma recorrente (mensal ou anual).
            Você pode cancelar a qualquer momento, mas:
          </p>
          <ul>
            <li>Não há reembolso proporcional ao período não utilizado</li>
            <li>O acesso continua até o final do período pago</li>
            <li>Os limites do plano gratuito serão aplicados após o cancelamento</li>
          </ul>

          <h2>6. Política de Reembolso</h2>
          <p>
            Oferecemos reembolso integral em até 7 dias após a primeira cobrança,
            desde que:
          </p>
          <ul>
            <li>Seja a primeira assinatura da conta</li>
            <li>O uso tenha sido mínimo (menos de 100 mensagens enviadas)</li>
            <li>A solicitação seja feita por email</li>
          </ul>

          <h2>7. Limitação de Responsabilidade</h2>
          <p>
            O Serviço é fornecido "como está", sem garantias de qualquer tipo.
            Não nos responsabilizamos por:
          </p>
          <ul>
            <li>Danos indiretos, incidentais ou consequenciais</li>
            <li>Perda de lucros ou dados</li>
            <li>Interrupções ou falhas no serviço</li>
            <li>Ações de terceiros (WhatsApp, Meta, operadoras)</li>
          </ul>

          <h2>8. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo, código, design e funcionalidades do Serviço são de
            nossa propriedade ou licenciados para nós. Você não pode copiar,
            modificar ou distribuir qualquer parte do Serviço sem autorização.
          </p>

          <h2>9. Privacidade</h2>
          <p>
            Sua privacidade é importante para nós. Consulte nossa{" "}
            <Link href="/privacy">
              <a className="text-primary hover:underline">Política de Privacidade</a>
            </Link>{" "}
            para entender como coletamos e usamos seus dados.
          </p>

          <h2>10. Modificações</h2>
          <p>
            Podemos modificar estes Termos a qualquer momento. Notificaremos
            sobre mudanças significativas por email ou através do Serviço. O uso
            continuado após as modificações constitui aceitação dos novos termos.
          </p>

          <h2>11. Rescisão</h2>
          <p>
            Podemos suspender ou encerrar sua conta a qualquer momento por
            violação destes Termos, sem aviso prévio. Em caso de rescisão:
          </p>
          <ul>
            <li>Seu acesso será imediatamente revogado</li>
            <li>Seus dados serão mantidos por 30 dias para backup</li>
            <li>Após 30 dias, os dados serão permanentemente excluídos</li>
          </ul>

          <h2>12. Lei Aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do
            Brasil. Qualquer disputa será resolvida nos tribunais da comarca de
            São Paulo, SP.
          </p>

          <h2>13. Contato</h2>
          <p>
            Para dúvidas sobre estes Termos, entre em contato através do email:
            suporte@exemplo.com
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Mensageria. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
