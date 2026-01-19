# 🧪 Teste Local - QR Code WhatsApp

## Como testar localmente

### Opção 1: Scripts Automáticos

```bash
# Terminal 1 - Backend
./start-backend.sh

# Terminal 2 - Frontend  
./start-frontend.sh
```

### Opção 2: Manual

#### 1. Iniciar Backend

```bash
cd backend

# Configurar variáveis de ambiente
export NODE_ENV=development
export LOCAL_PORT=3333
export AUTH_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export X_AUTH_API=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export INTERNAL_SYNC_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27
export FRONTEND_API_URL=http://localhost:3000
export IDENTIFICATION=mensageria
export WHATSAPP_GROUPS_CALLBACK_URL=http://localhost:3000/api/whatsapp/groups

# Instalar dependências (se necessário)
npm install

# Iniciar
npm run dev
```

#### 2. Iniciar Frontend

```bash
cd frontend

# Configurar variáveis de ambiente
export VITE_BACKEND_API_URL=http://localhost:3333
export VITE_BACKEND_API_TOKEN=cd739c87f3f7a8a6a69407b639a6d7c6db3090e0d6bbe4cbd4176950a1d9ab27

# Instalar dependências (se necessário)
pnpm install

# Iniciar
pnpm dev
```

### 3. Acessar

Abra o navegador em: **http://localhost:3000/whatsapp**

## 🔍 Debug

### Verificar se backend está rodando

```bash
curl http://localhost:3333/whatsapp/connections
```

### Verificar logs do Socket.IO

No console do backend, você deve ver:
- `[Socket.IO] Servidor Socket.IO inicializado no path: /socket.io`
- `[Socket.IO] ✅ Cliente conectado! Socket ID: ...`
- `[Socket.IO] 📥 requestQRCode recebido para: ...`

### Verificar logs do Baileys

No console do backend, você deve ver:
- `[addConnection] Iniciando conexão para: ...`
- `[Baileys] 🔄 Iniciando logout completo para: ...`
- `[Connection Update] 🔔 Evento recebido para conexão ...`
- `[QR Code] ✅ QR Code gerado para conexão: ...`

### Verificar logs do Frontend

No console do navegador (F12), você deve ver:
- `[WhatsApp] Socket.IO conectado! Socket ID: ...`
- `[WhatsApp] Emitindo requestQRCode com identification: ...`
- `[WhatsApp] ✅ Backend confirmou recebimento do requestQRCode`
- `[WhatsApp] Evento 'qrcode' recebido!`

## 🐛 Problemas Comuns

### Porta já em uso

```bash
# Verificar processos
lsof -ti:3333
lsof -ti:3000

# Matar processos
lsof -ti:3333 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Backend não inicia

- Verifique se todas as dependências estão instaladas: `cd backend && npm install`
- Verifique os logs de erro no terminal

### Frontend não conecta ao backend

- Verifique se `VITE_BACKEND_API_URL=http://localhost:3333` está configurado
- Verifique se o backend está rodando na porta 3333
- Abra o DevTools (F12) e verifique erros de CORS ou conexão

### QR Code não aparece

1. **Verifique os logs do backend** - Deve aparecer `[QR Code] ✅ QR Code gerado`
2. **Verifique os logs do frontend** - Deve aparecer `[WhatsApp] Evento 'qrcode' recebido`
3. **Verifique se há sessão antiga** - O logout deve remover arquivos em `backend/auth_info_baileys/`
4. **Aguarde até 30 segundos** - O timeout foi aumentado para 30s

## 📝 Checklist de Debug

- [ ] Backend iniciou sem erros na porta 3333
- [ ] Frontend iniciou sem erros na porta 3000
- [ ] Socket.IO conectou (ver logs do backend e frontend)
- [ ] Evento `requestQRCode` foi recebido pelo backend
- [ ] Backend confirmou recebimento (acknowledgment)
- [ ] Logout foi executado (arquivos removidos)
- [ ] `addConnection` foi chamado
- [ ] Evento `connection.update` foi disparado pelo Baileys
- [ ] QR Code foi gerado (`[QR Code] ✅ QR Code gerado`)
- [ ] Evento `qrcode` foi emitido pelo backend
- [ ] Frontend recebeu o evento `qrcode`

