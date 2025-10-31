# Mensageria - Sistema de Mensagens

Sistema de mensageria integrado com WhatsApp, Telegram e outras plataformas de comunicação.

## Tecnologias

- **Node.js 20+**
- **TypeScript**
- **Express.js**
- **Baileys** (WhatsApp Web API)
- **Telegraf** (Telegram Bot)
- **BullMQ** (Gerenciamento de filas)
- **Socket.IO** (Comunicação em tempo real)
- **Google Gemini AI** (Resumos e processamento de linguagem natural)

## Requisitos

- Node.js 20 ou superior
- Yarn
- Docker e Docker Compose (opcional)

## Instalação

### Opção 1: Instalação Local

```bash
# Instalar dependências
yarn install

# Copiar arquivo de configuração
cp .env.example .env

# Editar o arquivo .env com suas configurações
nano .env

# Compilar o projeto
yarn build

# Iniciar em modo de desenvolvimento
yarn dev

# Iniciar em modo de produção
yarn start
```

### Opção 2: Docker

```bash
# Criar arquivo .env
cp .env.example .env

# Editar configurações
nano .env

# Criar arquivo deploy.zip com os arquivos compilados
yarn build
cd build && zip -r ../deploy.zip . && cd ..

# Iniciar com Docker Compose
docker-compose up -d
```

## Configuração

Edite o arquivo `.env` com as seguintes informações:

### Configurações Básicas
- `NODE_ENV`: Ambiente (developer/production)
- `LOCAL_PORT`: Porta do servidor (padrão: 3333)
- `MENSAGERIA_HOST`: URL do host
- `SYSTEM_NAME`: Nome do sistema

### Autenticação
- `X_AUTH_API`: Chave de autenticação da API
- `AUTH_TOKEN`: Token de autenticação

### API Externa
- `API_URL`: URL da API do cliente

### Telegram
- `TELEGRAM_BOT_TOKEN`: Token do bot (obtido via BotFather)
- `TELEGRAM_CALL_BACK_URL_TO_SEND_USER_ID`: URL de callback

### WhatsApp
- `IDENTIFICATION`: Nomes das conexões separados por vírgula (ex: numero1,numero2,groupresume)

### Google Gemini AI
- `GOOGLE_API_KEY`: Chave da API do Google Gemini

### Resumo de Grupos WhatsApp
- `RESUME_WHATSAPP_GROUP_ID`: ID do grupo para monitorar
- `RESUME_WHATSAPP_GROUP_ID_TO_SEND`: ID do grupo para enviar resumo
- `RESUME_HOUR_OF_DAY`: Hora do dia para enviar resumo (0-23)

### Google Sheets
- `GOOGLE_SHEETS_API_KEY`: Chave da API do Google Sheets
- `GOOGLE_SPREADSHEET_ID`: ID da planilha

## Estrutura do Projeto

```
mensageria/
├── src/
│   ├── @types/          # Definições de tipos TypeScript
│   ├── config/          # Configurações do sistema
│   ├── controllers/     # Controladores da API
│   ├── database/        # Configuração do banco de dados
│   ├── errors/          # Tratamento de erros
│   ├── jobs/            # Jobs e tarefas agendadas
│   ├── libs/            # Bibliotecas auxiliares
│   ├── middlewares/     # Middlewares Express
│   ├── routes/          # Rotas da API
│   ├── services/        # Serviços de negócio
│   ├── utils/           # Utilitários
│   ├── views/           # Templates de visualização
│   ├── app.ts           # Configuração do Express
│   └── server.ts        # Servidor principal
├── auth_info_baileys/   # Dados de autenticação WhatsApp
├── messagesToResume/    # Mensagens para resumo
├── tmp/                 # Arquivos temporários
├── .env.example         # Exemplo de configuração
├── package.json         # Dependências do projeto
├── tsup.config.ts       # Configuração do build
└── docker-compose.yml   # Configuração Docker

```

## Funcionalidades

- ✅ Integração com WhatsApp via Baileys
- ✅ Bot do Telegram
- ✅ API RESTful com Swagger
- ✅ Autenticação e autorização
- ✅ Upload de arquivos
- ✅ Geração de QR Code para WhatsApp
- ✅ Resumo automático de grupos via IA
- ✅ Integração com Google Sheets
- ✅ Comunicação em tempo real via WebSocket

## API

Após iniciar o servidor, acesse a documentação da API em:

```
http://localhost:3333/api-docs
```

## Licença

MIT
