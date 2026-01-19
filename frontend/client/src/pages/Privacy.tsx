import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/landing">
            <a className="flex items-center gap-2">
              <MessageSquare className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">Mensageria</span>
            </a>
          </Link>
          <Link href="/landing">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Política de Privacidade</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString("pt-BR")}
          </p>

          <p>
            Esta Política de Privacidade descreve como a Mensageria coleta, usa e
            protege suas informações pessoais quando você utiliza nosso serviço.
            Estamos comprometidos em proteger sua privacidade e cumprir a Lei
            Geral de Proteção de Dados (LGPD).
          </p>

          <h2>1. Dados que Coletamos</h2>

          <h3>1.1 Dados de Cadastro</h3>
          <ul>
            <li>Nome completo</li>
            <li>Endereço de email</li>
            <li>Foto de perfil (quando fornecida via OAuth)</li>
            <li>Informações do provedor de autenticação (Google, GitHub, etc.)</li>
          </ul>

          <h3>1.2 Dados de Uso</h3>
          <ul>
            <li>Conexões WhatsApp configuradas</li>
            <li>Histórico de mensagens enviadas (metadados)</li>
            <li>Listas de contatos importados</li>
            <li>Configurações de campanhas</li>
            <li>Logs de acesso e atividade</li>
          </ul>

          <h3>1.3 Dados de Pagamento</h3>
          <ul>
            <li>Informações de cobrança são processadas pelo Stripe</li>
            <li>Não armazenamos números de cartão de crédito</li>
            <li>Mantemos apenas histórico de transações</li>
          </ul>

          <h3>1.4 Dados Técnicos</h3>
          <ul>
            <li>Endereço IP</li>
            <li>Tipo de navegador e dispositivo</li>
            <li>Páginas visitadas e ações realizadas</li>
            <li>Data e hora de acesso</li>
          </ul>

          <h2>2. Como Usamos seus Dados</h2>
          <p>Utilizamos suas informações para:</p>
          <ul>
            <li>Fornecer e manter o Serviço</li>
            <li>Processar pagamentos e gerenciar assinaturas</li>
            <li>Enviar notificações sobre sua conta</li>
            <li>Melhorar nosso Serviço e experiência do usuário</li>
            <li>Prevenir fraudes e abusos</li>
            <li>Cumprir obrigações legais</li>
            <li>Fornecer suporte ao cliente</li>
          </ul>

          <h2>3. Compartilhamento de Dados</h2>
          <p>Compartilhamos seus dados apenas com:</p>

          <h3>3.1 Provedores de Serviço</h3>
          <ul>
            <li>
              <strong>Stripe:</strong> Processamento de pagamentos
            </li>
            <li>
              <strong>Meta/WhatsApp:</strong> Integração com WhatsApp Business API
            </li>
            <li>
              <strong>Google:</strong> Autenticação OAuth e serviços de IA (Gemini)
            </li>
            <li>
              <strong>AWS:</strong> Armazenamento de arquivos (S3)
            </li>
          </ul>

          <h3>3.2 Obrigações Legais</h3>
          <p>
            Podemos divulgar dados quando exigido por lei, ordem judicial ou
            autoridade competente.
          </p>

          <h2>4. Segurança dos Dados</h2>
          <p>Implementamos medidas de segurança incluindo:</p>
          <ul>
            <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
            <li>Criptografia de dados sensíveis em repouso</li>
            <li>Acesso restrito baseado em funções</li>
            <li>Monitoramento de segurança contínuo</li>
            <li>Backups regulares</li>
            <li>Autenticação segura via OAuth 2.0</li>
          </ul>

          <h2>5. Retenção de Dados</h2>
          <p>Mantemos seus dados:</p>
          <ul>
            <li>
              <strong>Dados de conta:</strong> Enquanto sua conta estiver ativa
            </li>
            <li>
              <strong>Histórico de mensagens:</strong> Por 90 dias (metadados
              apenas)
            </li>
            <li>
              <strong>Logs de acesso:</strong> Por 12 meses
            </li>
            <li>
              <strong>Dados de pagamento:</strong> Por 5 anos (obrigação legal)
            </li>
          </ul>
          <p>
            Após exclusão da conta, seus dados são removidos em até 30 dias,
            exceto quando a lei exigir retenção.
          </p>

          <h2>6. Seus Direitos (LGPD)</h2>
          <p>De acordo com a LGPD, você tem direito a:</p>
          <ul>
            <li>
              <strong>Acesso:</strong> Solicitar cópia de seus dados pessoais
            </li>
            <li>
              <strong>Correção:</strong> Atualizar dados incorretos ou incompletos
            </li>
            <li>
              <strong>Exclusão:</strong> Solicitar remoção de seus dados
            </li>
            <li>
              <strong>Portabilidade:</strong> Receber seus dados em formato
              estruturado
            </li>
            <li>
              <strong>Revogação:</strong> Retirar consentimento a qualquer momento
            </li>
            <li>
              <strong>Oposição:</strong> Contestar tratamento de dados
            </li>
          </ul>
          <p>
            Para exercer esses direitos, entre em contato pelo email:
            privacidade@exemplo.com
          </p>

          <h2>7. Cookies e Tecnologias Similares</h2>
          <p>Utilizamos cookies para:</p>
          <ul>
            <li>Manter sua sessão autenticada</li>
            <li>Lembrar suas preferências</li>
            <li>Analisar uso do serviço (analytics)</li>
          </ul>
          <p>
            Você pode desabilitar cookies no navegador, mas isso pode afetar
            funcionalidades do serviço.
          </p>

          <h2>8. Transferência Internacional</h2>
          <p>
            Seus dados podem ser processados em servidores localizados fora do
            Brasil. Garantimos que os destinatários ofereçam nível adequado de
            proteção conforme a LGPD.
          </p>

          <h2>9. Menores de Idade</h2>
          <p>
            O Serviço não é destinado a menores de 18 anos. Não coletamos
            intencionalmente dados de menores. Se você é menor de idade, não
            utilize o Serviço.
          </p>

          <h2>10. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta Política periodicamente. Notificaremos sobre
            mudanças significativas por email ou através do Serviço. A data da
            última atualização está indicada no início deste documento.
          </p>

          <h2>11. Contato</h2>
          <p>Para questões sobre privacidade, contate:</p>
          <ul>
            <li>
              <strong>Email:</strong> privacidade@exemplo.com
            </li>
            <li>
              <strong>Encarregado de Dados (DPO):</strong> dpo@exemplo.com
            </li>
          </ul>

          <h2>12. Autoridade Supervisora</h2>
          <p>
            Você tem direito de apresentar reclamação à Autoridade Nacional de
            Proteção de Dados (ANPD) se considerar que o tratamento de seus dados
            viola a LGPD.
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
