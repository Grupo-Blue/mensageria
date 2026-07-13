# Estudo — Dashboard do Mensageria

> O que um dashboard de alto nível e preciso precisa trazer sobre um sistema de disparo
> em massa, e o que hoje está errado. Baseado no código e no schema atuais.
> Data: 13/07/2026.

---

## 1. Diagnóstico: o dashboard atual mede a coisa errada

Antes de propor o que incluir, o achado que muda tudo:

**Os disparos de campanha não aparecem no dashboard.** Os cards "Mensagens Enviadas" e
"Taxa de Sucesso" leem a tabela `messages`. Só que `db.createMessage()` é chamado apenas
em três lugares — o envio avulso da página *Enviar Mensagem* ([routers.ts:390](frontend/server/routers.ts#L390))
e as rotas legadas de WhatsApp. **O dispatcher de campanha nunca escreve em `messages`**:
ele grava em `baileys_campaign_recipients`.

Consequência prática: um cliente que disparou 50.000 mensagens em campanhas vê
**"0 Mensagens Enviadas"** no dashboard. O painel ignora justamente o motor principal do
produto e mostra apenas o envio manual, que é o uso marginal.

Três defeitos menores, na mesma linha:

- **A taxa de sucesso é calculada sobre 10 registros.** `Home.tsx` pede
  `messages.list({ limit: 10 })` e faz `sent / total` sobre essas 10 linhas. Não é uma taxa
  de sucesso — é uma amostra arbitrária das últimas 10 mensagens avulsas.
- **A tendência "vs último mês" das conexões é matematicamente sem sentido.** Em
  [db.ts:1961](frontend/server/db.ts#L1961), o "valor anterior" conta conexões que estão
  conectadas *agora* **e** cujo `lastConnectedAt` é anterior ao mês passado. Isso não é
  "quantas estavam conectadas no mês passado"; é um número sem interpretação possível.
- **Não existe histórico de envio**, que é literalmente o que você pediu. Existe uma lista
  das últimas 10 mensagens avulsas.

Ou seja: não é um caso de "adicionar uns cards". A fonte de dados do dashboard precisa ser
trocada.

---

## 2. O princípio: cada número existe para sustentar uma decisão

Um dashboard preciso não é o que mostra mais coisas — é o que responde, sem ambiguidade,
às perguntas que o operador faz todo dia. Para um sistema de disparo, são cinco:

1. **Estou conseguindo disparar agora?** (saúde operacional)
2. **Quanto disparei e com que resultado?** (volume e eficácia)
3. **Onde está o problema — qual chip, qual campanha, qual mensagem?** (diagnóstico)
4. **Minha base e minha reputação estão saudáveis?** (risco de ban)
5. **Estou dentro do meu plano?** (quota, se SaaS)

Se um número não muda nenhuma decisão, ele é decoração. Corte.

---

## 3. Camada 1 — Saúde operacional (o que exige ação nos próximos minutos)

Esta é a camada mais importante e a que hoje quase não existe. Num sistema de disparo, o
prejuízo silencioso é a campanha que **parou** sem ninguém perceber.

### 3.1 Telefones conectados — X de Y

O número que você citou, e com razão: é o gargalo físico do sistema. Mas o card precisa ser
mais honesto que um "3 conectados". O schema
([whatsapp_connections.status](frontend/drizzle/schema.ts#L32)) tem quatro estados:
`connected`, `connecting`, `qr_code`, `disconnected`. A quebra importa — um chip em `qr_code`
significa "precisa de alguém escanear agora"; um `disconnected` significa "chip caiu, a
campanha está disparando com menos capacidade".

```
Telefones          3 de 5 conectados
                   ● 3 conectados   ● 1 aguardando QR   ● 1 caído
                   ⚠ +55 11 9xxxx-1234 caiu há 2h
```

### 3.2 Capacidade de disparo hoje (o dado mais subestimado)

O throughput real não é "quantas mensagens quero mandar" — é a soma dos `warmupDailyLimit`
de cada conexão conectada, menos o que já saiu hoje. Esse número já é calculável:
`countBaileysSentTodayForConnection()` existe em [db.ts:767](frontend/server/db.ts#L767) e o
scheduler já o usa para pular chips saturados.

```
Capacidade hoje    3.240 / 5.000 mensagens   (65% do teto diário consumido)
```

Isso responde a pergunta "consigo rodar essa campanha de 10 mil hoje?" — que hoje ninguém
consegue responder sem abrir o banco.

### 3.3 Fila e ETA

Destinatários `pending` nas campanhas `running`, e uma estimativa de conclusão derivada do
delay médio configurado e do número de conexões ativas. "12.400 na fila · ~9h no ritmo atual"
vale mais que qualquer gráfico bonito.

### 3.4 Conexões em risco

Um bloco de alertas acionáveis, não um contador: chip com proxy morto
(`webshare_proxies.status = 'dead'`), chip sem proxy atribuído, campanha pausada
automaticamente por falha de conexão, taxa de erro subindo num chip específico.

---

## 4. Camada 2 — Volume e resultado (o "histórico de envio")

### 4.1 A unificação que precisa acontecer

O histórico precisa somar as **três** fontes de envio, hoje desconectadas:

| Fonte | Tabela | Hoje aparece no dash? |
|---|---|---|
| Campanhas Baileys (disparo em massa) | `baileys_campaign_recipients` | ❌ Não |
| Campanhas Meta (API oficial) | `campaign_recipients` | ❌ Não |
| Envio avulso e API v1 | `messages` | ✅ Sim (é só isso que aparece) |

Recomendação: uma query de agregação que una as três por dia, ou — mais robusto a longo
prazo — um log de envio unificado. A segunda opção é uma decisão de schema; a primeira
resolve o dashboard sem migration.

### 4.2 Os números

- **Enviados hoje / 7 dias / 30 dias**, com um período explícito e visível (nada de
  "recentes" sem definição).
- **Série temporal diária**: barras empilhadas de enviado × falhado. É o "histórico de envio"
  que você pediu, e é onde o cliente enxerga ritmo, quedas e picos.
- **Taxa de falha real** = `falhados / (enviados + falhados)` no período — não sobre 10 linhas.
- **Volume por hora do dia** (heatmap hora × dia da semana): mostra a janela real de disparo
  e ajuda a decidir agendamento.

### 4.3 Uma honestidade que o dashboard precisa embutir

**Baileys não confirma entrega nem leitura.** O que o sistema sabe é que a mensagem *saiu*.
Já as campanhas via API oficial da Meta têm `delivered` e `read` em
`campaign_recipients.status`.

Um dashboard que mostrasse "taxa de leitura" para disparo Baileys estaria inventando número.
O correto é rotular por canal: para Baileys, **"Enviadas"** e **"Falhas"**; para Meta,
**"Entregues"** e **"Lidas"** — e deixar claro na interface por que a coluna está vazia num
caso. Essa é exatamente a diferença entre um dashboard preciso e um bonito.

---

## 5. Camada 3 — Diagnóstico (onde está o problema)

Um número agregado diz que algo piorou; esta camada diz **o quê**.

### 5.1 Por telefone/conexão — a tabela mais valiosa do sistema

| Telefone | Status | Enviadas hoje | Uso do warmup | Taxa de falha | Proxy/IP |
|---|---|---|---|---|---|

Uma taxa de falha subindo num chip específico é o **sinal antecedente de banimento**. Detectar
isso um dia antes vale mais que qualquer outro número do painel. O dado já existe:
`baileys_campaign_recipients.sentFromConnectionId` registra qual conexão disparou cada
mensagem — foi criado no PR de multi-conexão e **ninguém ainda consome isso para análise**.

### 5.2 Por campanha

Progresso (enviados/total), taxa de falha, velocidade real (msgs/hora), tempo restante,
status. Substitui o "abrir cada campanha para ver como vai".

### 5.3 Por variação de mensagem — o insight escondido no schema

`baileys_campaign_recipients.sentVariantIndex` guarda **qual das 5 variações** foi usada em
cada envio. Cruzando com o status, você descobre se uma variação específica está falhando
mais que as outras — ou seja, se um texto está sendo filtrado. Esse dado está gravado hoje e
nunca foi olhado. É análise anti-ban gratuita.

### 5.4 Top motivos de falha

`errorMessage` agrupado: "número não existe no WhatsApp", "conexão caiu", "rate limit",
"proxy". Cada motivo aponta uma ação diferente — base ruim, chip caído, ritmo agressivo
demais, proxy morto. Um contador de "230 falhas" sem essa quebra não serve para nada.

---

## 6. Camada 4 — Saúde da base e reputação

- **Opt-outs e blacklist** (`whatsapp_blacklist`, `contact_list_items.status`): crescimento de
  descadastros e denúncias de spam é o indicador que antecede o banimento. Merece uma linha
  de tendência, não um número solto.
- **Qualidade da base**: % de números inválidos por lista. Uma lista com 30% de inválidos está
  queimando seus chips à toa.
- **Webhooks falhando** (`webhook_logs`): integração quebrada é receita perdida silenciosa.

---

## 7. Camada 5 — Plano e quota (se o SaaS estiver ativo)

`usage_records` + `plans` já suportam: mensagens usadas no mês vs limite do plano, conexões
usadas vs limite. É o que gera upgrade, e é barato de exibir.

---

## 8. Proposta de layout

```
┌─ AGORA ────────────────────────────────────────────────────────────────┐
│  Telefones          Capacidade hoje       Na fila           Campanhas   │
│  3 de 5 ●●●○○       3.240 / 5.000         12.400            2 rodando   │
│  1 caiu há 2h       65% consumido         ~9h restantes                 │
├─ ALERTAS ──────────────────────────────────────────────────────────────┤
│  ⚠ +55 11 9xxxx-1234 desconectado — campanha "Black Friday" desacelerou │
│  ⚠ Proxy morto na conexão "chip-03"                                     │
├─ HISTÓRICO DE ENVIO ───────────────────────────────────────────────────┤
│  [ barras empilhadas por dia: enviado × falhado — 30 dias ]            │
│  Enviadas 30d: 84.320    Falhas: 3.1%    Ritmo: 2.800/dia              │
├─ POR TELEFONE ─────────────────┬─ MOTIVOS DE FALHA ────────────────────┤
│  chip-01  ● 1.200  92% warmup  │  Número não existe        1.890  61%  │
│  chip-02  ● 980    49% warmup  │  Conexão caiu               520  17%  │
│  chip-03  ⚠ 310    falha 22%   │  Rate limit                 410  13%  │
└────────────────────────────────┴───────────────────────────────────────┘
```

A hierarquia importa: **o que exige ação hoje fica em cima**; o histórico, no meio; o
diagnóstico, embaixo. O erro clássico é abrir com um gráfico bonito de 30 dias enquanto um
chip está caído há duas horas.

---

## 9. O que dá para construir com o schema atual — e o que não dá

**Já é possível hoje, sem nenhuma migration:** telefones por status, capacidade/warmup
consumido, fila e ETA, histórico diário unificado, taxa de falha real, motivos de falha,
desempenho por conexão, desempenho por variação, opt-outs, quota do plano.

**Não é possível hoje:** *uptime* dos chips e histórico de quedas. `whatsapp_connections`
guarda só o estado atual e `lastConnectedAt` — não há registro de eventos de conexão. Para
responder "esse chip caiu quantas vezes esta semana?" seria preciso uma tabela nova
(`connection_events`), e isso é uma decisão de schema a tomar antes, não durante.

Também vale registrar: as tendências "vs último mês" só passam a fazer sentido depois que a
fonte de dados for corrigida. Enquanto o cálculo atual permanecer, é melhor **remover** os
indicadores de tendência do que exibir números sem significado.

---

## 10. Resumo

O dashboard atual mostra o envio avulso e ignora o disparo em massa — que é o produto. Antes
de desenhar qualquer card novo, a fonte de dados precisa passar a incluir
`baileys_campaign_recipients` e `campaign_recipients`.

Feito isso, um dashboard preciso para este sistema se organiza em cinco camadas: **saúde
operacional agora** (telefones conectados por status, capacidade diária de disparo, fila,
alertas acionáveis), **volume e resultado** (histórico diário unificado, taxa de falha real),
**diagnóstico** (por telefone, por campanha, por variação de mensagem, por motivo de falha),
**reputação da base** (opt-outs, denúncias, qualidade das listas) e **quota do plano**.

O maior ganho escondido: o schema **já grava** qual conexão e qual variação de mensagem foram
usadas em cada envio, e ninguém analisa isso. É detecção precoce de chip queimando e de texto
filtrado — de graça, sem mudar uma linha do banco.
