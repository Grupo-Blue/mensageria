# Configuração do Bot do Telegram

## Erro 404: Not Found

Se você está recebendo o erro `404: Not Found` ao inicializar o bot do Telegram, isso geralmente significa que:

1. **O token do bot está incorreto ou inválido**
2. **O token não está configurado no arquivo `.env`**
3. **O token está vazio ou com espaços extras**

## Como Resolver

### 1. Obter um Token Válido

1. Abra o Telegram e procure por [@BotFather](https://t.me/botfather)
2. Envie o comando `/newbot`
3. Siga as instruções:
   - Escolha um nome para o bot
   - Escolha um username (deve terminar com `bot`, ex: `meu_bot`)
4. O BotFather irá fornecer um token no formato:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
   ```

### 2. Configurar o Token

1. Abra o arquivo `.env` na pasta `backend/`
2. Adicione ou atualize a variável:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
   ```
3. **Importante**: 
   - Não adicione espaços antes ou depois do token
   - Não adicione aspas ao redor do token
   - O token deve estar em uma única linha

### 3. Verificar a Configuração

Execute este comando para verificar se o token está configurado:

```bash
cd backend
grep TELEGRAM_BOT_TOKEN .env
```

O resultado deve mostrar algo como:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
```

### 4. Reiniciar o Servidor

Após configurar o token, reinicie o servidor:

```bash
# Se estiver em desenvolvimento
yarn dev

# Se estiver em produção
yarn start
```

## Validação do Token

O código agora valida automaticamente:
- ✅ Se o token existe e não está vazio
- ✅ Se o token tem o formato correto (número:hash)
- ✅ Se o token é válido na API do Telegram

## Mensagens de Erro

### Token não configurado
```
[Telegram] TELEGRAM_BOT_TOKEN não configurado. Bot do Telegram desabilitado.
```
**Solução**: Adicione o token no arquivo `.env`

### Token inválido
```
[Telegram] TELEGRAM_BOT_TOKEN inválido. Formato esperado: número:hash
```
**Solução**: Verifique se o token está no formato correto

### Token não encontrado (404)
```
[Telegram] Token inválido ou bot não encontrado.
```
**Solução**: 
- Verifique se o token está correto
- Verifique se o bot ainda existe no Telegram
- Obtenha um novo token do BotFather

### Token não autorizado (401)
```
[Telegram] Token não autorizado. Verifique se o token está correto.
```
**Solução**: O token pode ter sido revogado. Obtenha um novo token do BotFather

## Testar o Bot

Após configurar corretamente, você deve ver no console:
```
[Telegram] Bot inicializado com sucesso!
```

Para testar:
1. Abra o Telegram
2. Procure pelo seu bot pelo username que você configurou
3. Envie `/start`
4. O bot deve responder com uma mensagem de boas-vindas

## Outras Variáveis Necessárias

Além do `TELEGRAM_BOT_TOKEN`, você também precisa configurar:

```env
# Nome do sistema (usado nas mensagens do bot)
SYSTEM_NAME=Mensageria

# URL de callback para enviar user ID do Telegram
TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID=http://localhost:3000/api/telegram/callback
```

## Suporte

Se o problema persistir:
1. Verifique se o arquivo `.env` está na pasta `backend/`
2. Verifique se o arquivo `.env` está sendo carregado (o código usa `dotenv/config`)
3. Verifique os logs do console para mais detalhes
4. Teste o token diretamente na API do Telegram:
   ```bash
   curl https://api.telegram.org/bot<SEU_TOKEN>/getMe
   ```

