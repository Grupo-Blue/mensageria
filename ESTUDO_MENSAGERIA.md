# Estudo do Sistema de Mensageria

> Documento executivo e técnico. Descreve o que o sistema é, o que ele faz e por que
> ele é útil para quem o contratar. Baseado no código real do repositório (não em
> planejamento). Última revisão: 12/07/2026.

---

## 1. Em uma frase

**Uma plataforma web para disparo e gestão de mensagens em massa via WhatsApp e Telegram**,
com múltiplas conexões por cliente, roteamento de IP por proxy para reduzir bloqueios,
recursos anti-ban, campanhas agendadas, API pública e cobrança por assinatura (SaaS).

---

## 2. O que ele é

O Mensageria é um **produto SaaS full-stack** (multi-cliente, com planos e cobrança)
construído sobre dois serviços independentes:

| Camada | Pasta | Função |
|--------|-------|--------|
| **Aplicação** | `frontend/` | Interface React + API (Express/tRPC) + banco (Drizzle/MySQL). Onde vivem regras de negócio, campanhas, planos e o painel administrativo. |
| **Motor de mensageria** | `backend/` | Serviço Docker que mantém as sessões de WhatsApp (Baileys) e o bot do Telegram, envia mensagens e devolve status em tempo real (Socket.IO). |

Os dois se comunicam por HTTP autenticado por token. O banco MySQL pertence apenas à
aplicação; o motor não tem banco próprio — ele lê a configuração das conexões da própria
aplicação e reporta status de volta.

**Stack principal:** React 19 + Vite + TailwindCSS no cliente; Express + tRPC + Zod +
Drizzle ORM (MySQL) no servidor; Node + Baileys + Telegraf + Socket.IO + Redis no motor.
Login por Google OAuth, cobrança por Stripe, proxies via Webshare, IA via Google Gemini.

Há **dois caminhos de WhatsApp** disponíveis, o que é uma diferença importante do produto:

- **WhatsApp via Baileys (não oficial, por QR Code)** — conecta-se a números comuns lendo
  o QR Code, como o WhatsApp Web. É o motor principal de disparo em massa. Não exige
  aprovação da Meta nem templates, mas exige cuidados anti-ban (que o sistema automatiza).
- **WhatsApp Business API (oficial, da Meta)** — envia por templates aprovados, com métricas
  de entregue/lido. Mais formal e estável, sujeito às regras e custos da Meta.

O cliente escolhe o caminho conforme o caso de uso.

---

## 3. O que ele faz (funcionalidades implementadas)

### 3.1 Conexões de canais
- **Múltiplas conexões de WhatsApp (Baileys) por cliente**, cada uma com sua própria API
  key, autenticadas por QR Code, com status ao vivo via Socket.IO e reconexão automática.
- **Contas WhatsApp Business (Meta)** com sincronização e criação de templates, envio,
  consulta de status de mensagem e informações do número.
- **Bots de Telegram** para envio de mensagens.
- **Aquecimento ("warmup") por conexão**: limite diário configurável por número, para
  amadurecer chips novos e reduzir risco de bloqueio.
- **Roteamento de IP por proxy (Webshare)**: cada conexão recebe um proxy estático fixo
  na criação, mantendo um IP de saída constante por número (com troca automática se o
  proxy morrer, preferindo o mesmo país). Opcional — sem chave, o sistema opera sem proxy.

### 3.2 Disparo em massa e campanhas
- **Campanhas Baileys (motor principal)** com:
  - **Agendamento** (`scheduledAt`) — a campanha inicia sozinha no horário marcado e
    sobrevive a reinícios do servidor (estado no banco).
  - **Round-robin multi-conexão** — distribui os envios entre vários números da conta,
    registrando de qual conexão cada mensagem saiu; pula automaticamente números offline
    ou que já bateram o limite de aquecimento.
  - **Recursos anti-ban**: até 5 variações da mesma mensagem sorteadas por destinatário,
    intervalo aleatório entre envios (padrão 8–25s) e IP fixo por número.
  - **Limite diário por campanha** (pausa e retoma no dia seguinte).
  - **Personalização por destinatário** com placeholders `{{nome}}`, `{{campo}}`.
  - **Mídia**: imagem, documento e áudio (texto vira legenda em imagem/documento).
  - **Retentativas** configuráveis (automáticas e manuais) para mensagens que falharam.
  - **Relatórios/estatísticas**: enviados, falhados e recontagem por SQL.
- **Campanhas WhatsApp Business (Meta)** em paralelo, baseadas em templates aprovados,
  com contadores de entregue e lido.
- **Envio avulso** de mensagem (fora de campanha) para WhatsApp e Telegram.

### 3.3 Contatos e conformidade
- **Listas de contatos** com campos personalizados e status por contato
  (ativo, inválido, opt-out, denunciado como spam).
- **Blacklist / opt-out automático** por conta Business (motivos: pediu para sair,
  cancelar, denúncia de spam, manual, bounce), com filtragem de destinatários bloqueados.

### 3.4 Integrações de entrada e saída
- **Webhooks de mensagens recebidas** por conexão, assinados com HMAC SHA-256 e com retry.
- **Webhook de "campanha disparada"** para integrar disparos a sistemas externos.
- **API REST pública (v1)**: dispara em massa por HTTP (`POST /v1/connections/:id/messages/bulk`),
  autenticada por API key da conexão e com rate limit — permite integrar o Mensageria a
  qualquer sistema do cliente.

### 3.5 IA
- **Análise e resumo automático de grupos de WhatsApp** via Google Gemini (resumo diário
  configurável), disponível conforme o plano.

### 3.6 SaaS: planos, cobrança e administração
- **Planos e assinaturas** com preço mensal/anual e **limites por plano** (nº de conexões,
  contas Business, campanhas/mês, contatos por lista, mensagens/mês) e **flags de recursos**
  (webhooks, API, IA, suporte prioritário, remoção de branding).
- **Cobrança via Stripe**: checkout, portal do cliente, cancelamento e webhooks de
  pagamento/assinatura. Registro de histórico de pagamentos.
- **Controle de uso**: contabilização mensal por cliente e bloqueio ao ultrapassar o limite
  do plano (com fallback para um plano gratuito quando não há assinatura ativa).
- **Painel administrativo**: gestão de usuários, assinaturas e planos; monitoramento de
  conexões (inclusive offline); log de erros; relatórios de churn e receita; configurações
  globais e modo manutenção.
- **Compartilhamento de conta**: convidar outros usuários por e-mail para **visualizar**
  seus disparos (acesso somente leitura, expira em 7 dias).

### 3.7 Autenticação e segurança
- Login por **Google OAuth**; sessões por cookie; papéis `user`/`admin`.
- **Isolamento de dados por cliente** (todas as consultas filtram pelo usuário).
- Validação de entrada com **Zod** em toda a API; comunicação entre serviços autenticada
  por token; webhooks assinados.

---

## 4. Como funciona, na prática (fluxo típico)

1. O cliente entra com o Google e escolhe um plano (Stripe).
2. Cria uma ou mais conexões de WhatsApp, escaneando o QR Code de cada número. Cada conexão
   recebe automaticamente um IP fixo (proxy) e pode ter um limite diário de aquecimento.
3. Importa uma lista de contatos (com campos para personalização) e cria uma campanha:
   escreve o texto (com variações e placeholders), anexa mídia se quiser, define os
   intervalos anti-ban, o limite diário e — se desejar — agenda um horário.
4. Ao iniciar, o motor distribui os envios entre os números em round-robin, respeitando
   aquecimento, limites e intervalos aleatórios; contatos em blacklist são filtrados.
5. O cliente acompanha estatísticas (enviados/falhados) em tempo real, reprocessa falhas e,
   opcionalmente, recebe eventos por webhook. Tudo isso também pode ser acionado via API.

---

## 5. Para quem contrata: por que é útil

**Público-alvo:** agências de marketing, times de vendas/SDR, e-commerces, prestadores de
serviço e qualquer negócio que precise conversar com muitos clientes por WhatsApp/Telegram —
além de quem quer **revender** a capacidade como serviço (o produto já é multi-cliente e
cobra por assinatura).

**Benefícios concretos:**

- **Escala com menos bloqueios.** A combinação de múltiplos números em round-robin, IP fixo
  por número, aquecimento gradual, variações de mensagem e intervalos aleatórios ataca
  diretamente as causas comuns de banimento em disparo de volume — um diferencial frente a
  soluções que só "enviam rápido".
- **Dois caminhos de WhatsApp num só produto.** Baileys (rápido de configurar, sem burocracia
  da Meta) e API oficial (formal, com métricas de entrega) convivem — o cliente escolhe pelo
  caso de uso, sem trocar de ferramenta.
- **Pronto para operar como negócio.** Planos, limites, cobrança recorrente, painel admin e
  relatórios já existem — quem contrata pode usar internamente **ou** revender.
- **Integra com o que o cliente já tem.** API REST pública e webhooks assinados permitem
  plugar o disparo em CRMs, e-commerces e automações existentes.
- **Personalização e conformidade.** Mensagens personalizadas por contato, controle de
  opt-out/blacklist e listas segmentadas ajudam a respeitar quem não quer ser contatado.
- **Visibilidade e governança.** Estatísticas por campanha, logs de erro, monitoramento de
  conexões e compartilhamento somente-leitura dão controle a gestores e permitem auditoria.
- **Recursos de IA embutidos.** Resumo automático de grupos com Gemini agrega valor sem
  ferramentas extras.

---

## 6. Limites e pontos de atenção (transparência)

Para uma avaliação honesta de quem for contratar ou investir:

- **WhatsApp via Baileys é não oficial.** É eficaz e amplamente usado, mas está sujeito às
  políticas do WhatsApp; disparo de massa sempre carrega risco de bloqueio de número. Os
  recursos anti-ban **reduzem**, mas não eliminam, esse risco. A API oficial da Meta é a via
  formal quando isso for um requisito.
- **O "tenant" é o usuário individual.** Não há entidade de organização/time com papéis
  ricos; o compartilhamento entre pessoas existe apenas como **visualização** (viewer),
  não como colaboração com permissões de edição.
- **O agendador de campanhas é um processo único (singleton em memória).** Ele guarda o
  estado no banco e sobrevive a reinícios, mas, como está, **não escala horizontalmente**
  para múltiplas instâncias sem um mecanismo de "claim" atômico (limitação registrada no
  próprio código). É adequado a um volume operacional saudável em uma instância; escala
  massiva exigiria esse ajuste.
- **Armazenamento de mídia** usa um serviço de storage por proxy ("Forge/Manus"), não S3
  direto — algo a validar conforme a infraestrutura de destino.
- **Dependências externas** para pleno funcionamento: Stripe (cobrança), Webshare (proxies,
  opcional), Google (OAuth e Gemini) e a infraestrutura da Meta (para o caminho oficial).

---

## 7. Resumo

O Mensageria é uma plataforma **madura e comercializável** de comunicação em massa por
WhatsApp e Telegram. Seu valor central está em **enviar volume com o mínimo de bloqueios**
(multi-conexão, IP fixo, aquecimento, anti-ban) e em já vir **pronto para virar negócio**
(planos, cobrança, admin, API). É especialmente útil para agências, times de vendas,
e-commerces e revendedores. As principais ressalvas — natureza não oficial do Baileys,
ausência de organizações/times e o agendador de instância única — são conhecidas e
gerenciáveis, e devem ser pesadas conforme o volume e o nível de formalidade exigidos.
