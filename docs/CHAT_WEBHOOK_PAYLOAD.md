# Webhook: Payload de disparo para sistema de chat

Payload enviado pelo **mensageria** quando uma campanha de disparo (WhatsApp Business) é concluída. O sistema de chat pode usar esses dados para criar ou atualizar leads e dar sequência ao atendimento.

## Requisitos do endpoint (lado do chat)

- **Método:** `POST`
- **URL:** definida pela aplicação de chat; o mensageria envia para a URL configurada em `CHAT_WEBHOOK_URL`.
- **Headers:**
  - `Content-Type: application/json` (sempre enviado)
  - `Authorization: Bearer <token>` (quando `CHAT_WEBHOOK_SECRET` está configurado)

## Corpo da requisição (JSON)

Exemplo:

```json
{
  "event": "campaign.dispatched",
  "dispatchedAt": "2025-02-23T14:30:00.000Z",
  "campaignId": 42,
  "campaignName": "Promoção Black Friday",
  "company": "Minha Empresa Ltda",
  "message": "Olá Maria, sua oferta especial está disponível. Acesse o link para garantir.",
  "contacts": [
    { "name": "Maria Silva", "phone": "5511999999999" },
    { "name": "João Santos", "phone": "5511888888888" }
  ]
}
```

### Campos

| Campo          | Tipo     | Descrição |
|----------------|----------|-----------|
| `event`        | string   | Sempre `"campaign.dispatched"` para identificar o tipo de evento. |
| `dispatchedAt` | string   | Data e hora do disparo em ISO 8601 (ex.: `2025-02-23T14:30:00.000Z`). |
| `campaignId`   | number   | ID da campanha no mensageria. |
| `campaignName` | string   | Nome da campanha. |
| `company`      | string   | Empresa que fez o disparo (nome da conta WhatsApp Business configurada no mensageria). |
| `message`     | string   | Texto da mensagem enviada (template renderizado com variáveis globais da campanha). Serve como referência; o conteúdo por contato pode variar (ex.: nome). |
| `contacts`     | array    | Lista de contatos que **receberam** a mensagem com sucesso (status enviado/entregue/lido). |
| `contacts[].name`  | string \| null | Nome do contato, quando disponível. |
| `contacts[].phone` | string   | Telefone do contato (formato usado pelo mensageria). |

## Comportamento

- O mensageria envia o webhook em **fire-and-forget**: não espera retry em caso de falha. O endpoint do chat deve responder com status **2xx** para indicar sucesso.
- Para evitar duplicidade, o sistema de chat pode tratar o evento como idempotente usando a chave `campaignId` + `dispatchedAt`.
