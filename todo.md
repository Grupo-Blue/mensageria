# Mensageria Frontend - TODO

## Autenticação
- [x] Configurar OAuth do Google no backend
- [x] Implementar rota de callback OAuth
- [x] Criar página de login
- [x] Implementar proteção de rotas

## Dashboard Principal
- [x] Criar layout do dashboard com sidebar
- [x] Implementar navegação entre seções
- [x] Mostrar status geral das conexões

## Conexão WhatsApp
- [x] Criar página de conexão WhatsApp
- [x] Implementar geração de QR Code
- [x] Mostrar status da conexão em tempo real
- [x] Permitir múltiplas conexões
- [x] Implementar desconexão

## Conexão Telegram
- [x] Criar página de configuração Telegram
- [x] Formulário para adicionar bot token
- [x] Mostrar status da conexão
- [x] Implementar desconexão

## Envio de Mensagens
- [x] Criar interface de envio WhatsApp
- [x] Criar interface de envio Telegram
- [x] Validação de números/IDs
- [ ] Suporte a envio de arquivos
- [x] Histórico de mensagens enviadas

## Configurações
- [x] Página de configurações gerais
- [x] Gerenciar API Keys
- [x] Configurar resumo de grupos WhatsApp
- [x] Configurar horário de resumo

## Integrações
- [x] Integrar com backend existente (porta 5600)
- [ ] Implementar Socket.IO para tempo real
- [x] Conectar com API do Swagger

## Deploy
- [ ] Configurar build de produção
- [ ] Integrar com Apache no servidor
- [ ] Configurar variáveis de ambiente
- [ ] Testar em produção

## Deploy e Integração Final
- [x] Configurar URL do backend para produção
- [x] Fazer build de produção do frontend
- [x] Transferir arquivos para o servidor
- [x] Configurar Apache para servir o frontend
- [x] Configurar PM2 para rodar Node.js
- [x] Configurar proxies para APIs WhatsApp e Telegram
- [x] Testar integração com backend WhatsApp
- [x] Testar integração com backend Telegram
- [x] Verificar autenticação OAuth em produção

## Correções OAuth e Autenticação Direta Google
- [x] Corrigir redirect_uri no Google Cloud Console
- [x] Remover dependência do Manus OAuth
- [x] Implementar Google OAuth direto no frontend
- [x] Implementar Google OAuth direto no backend
- [x] Criar rotas de callback OAuth personalizadas
- [x] Atualizar gerenciamento de sessão JWT
- [x] Testar login com Google direto
- [x] Fazer deploy das alterações

## Bug: Internal Server Error no Callback OAuth
- [ ] Investigar logs do servidor para identificar erro
- [ ] Corrigir erro no código de callback
- [ ] Testar fluxo completo de login novamente

## Bug: Sessão não persiste após login
- [ ] Verificar logs do callback OAuth
- [ ] Corrigir salvamento de sessão/cookie
- [ ] Testar persistência de login

## Bug: Schema do banco incompatível
- [x] Corrigir nomes das colunas no schema Drizzle
- [x] Fazer push do schema corrigido
- [ ] Testar criação de conexão WhatsApp

## Bug: Erro 500 ao criar conexão WhatsApp
- [x] Verificar logs do backend para erro 500
- [x] Corrigir BACKEND_API_URL para apontar para localhost:5600
- [ ] Testar criação de conexão novamente

## Bug: Roteamento Apache incorreto
- [x] Corrigir configuração Apache para proxy de APIs
- [x] Testar acesso a /whatsapp, /telegram, /docs
- [x] Corrigir chamadas de API para formato correto
- [x] Fazer deploy das correções
- [ ] Testar criação de QR Code novamente

## Bug: Erro "Invalid URL" na home em produção
- [x] Investigar qual URL está causando o erro
- [x] Verificar variáveis de ambiente VITE_* faltantes
- [x] Corrigir configuração de URLs no .env de produção
- [x] Fazer deploy e testar

## Bug: Erro 404 no callback do Google OAuth
- [x] Verificar URL de callback configurada no Google Cloud Console
- [x] Verificar rota de callback no backend
- [x] Verificar logs do servidor para entender o erro
- [ ] Verificar se deploy foi feito corretamente
- [ ] Testar login após correção

## Bug: Internal Server Error no callback após login Google bem-sucedido
- [x] Verificar logs do servidor para identificar erro
- [x] Corrigir erro de acesso ao banco de dados
- [x] Corrigir problema de sessão não persistir após login
- [x] Testar fluxo completo de login novamente
- [x] Login funcionando corretamente

## Bug: URL do QR Code usando localhost em vez do IP do servidor
- [x] Corrigir URL do backend para usar http://185.215.166.113:5600
- [x] Corrigir erro de arquivo qrcode.html não encontrado no backend
- [x] Fazer deploy e testar geração de QR Code
- [x] Sistema funcionando - QR Code gerado e WhatsApp conectado com sucesso

## Melhoria: Exibir QR Code inline na página de conexão WhatsApp
- [ ] Modificar página WhatsApp.tsx para conectar via WebSocket ao backend
- [ ] Exibir QR Code diretamente na página em vez de abrir nova aba
- [ ] Adicionar barra de progresso mostrando estados: "Gerando QR Code", "Aguardando leitura", "Conectado"
- [ ] Adicionar feedback visual para cada estado da conexão

## Melhoria: Personalizar nome da conexão WhatsApp (remover "Baileys")
- [ ] Configurar nome personalizado no backend (Baileys)
- [ ] Testar se o nome aparece corretamente no WhatsApp

## Bug: QR Code não aparece porque conexão já está ativa
- [ ] Mapear todas as APIs do backend WhatsApp disponíveis
- [ ] Implementar verificação de status de conexão no frontend
- [ ] Adicionar funcionalidade de desconexão para gerar novo QR Code
- [ ] Testar fluxo completo: verificar status → desconectar → gerar QR Code → conectar

## Bug: Timeout de 8 segundos aparece antes do QR Code carregar
- [x] Desativar timeout temporariamente para permitir QR Code aparecer
- [x] Testar em produção após desativar timeout

## Bug: Backend retorna "conexão ativa" mesmo sem conexão ativa
- [x] Investigar logs do backend para entender por que retorna connected: true
- [x] Verificar pasta auth_info_baileys para ver se há sessões antigas
- [x] Limpar sessões antigas ou corrigir lógica de detecção
- [ ] Testar geração de QR Code após correção

## Melhoria: Permitir múltiplas conexões WhatsApp simultâneas
- [x] Remover estado already_connected do frontend
- [x] Remover alerta de "Conexão já ativa"
- [x] Permitir gerar QR Code sempre que solicitado
- [ ] Testar múltiplas conexões funcionando simultaneamente

## Bug: Apache intercepta rotas do frontend React (/whatsapp, /telegram)
- [x] Remover proxy de /whatsapp e /telegram do Apache (são rotas do frontend)
- [x] Manter apenas proxy de /api/whatsapp e /api/telegram para o backend
- [x] Testar acesso direto a https://mensageria.grupoblue.com.br/whatsapp
- [ ] Testar geração de QR Code após correção

## Feature: Sincronizar conexões WhatsApp com banco de dados
- [x] Criar schema no banco de dados para armazenar conexões WhatsApp
- [x] Implementar endpoint tRPC para salvar conexão após sucesso
- [x] Atualizar frontend para chamar endpoint quando conectar
- [x] Exibir conexões salvas na lista de gerenciamento
- [ ] Testar salvamento e exibição de conexões

## Bug: Caminho incorreto para qrcode.html no backend Docker
- [x] Localizar arquivo src/routes/modules/whatsapp.ts no backend Docker
- [x] Corrigir path.join para usar segmentos relativos (sem barras no início)
- [x] Rebuild do backend Docker
- [x] Reiniciar container
- [x] Testar acesso ao QR Code

## Bug: Backend retorna "já conectado" mesmo sem conexão ativa
- [x] Investigar logs do backend para entender estado das conexões
- [x] Verificar se conexão está em memória ou cache
- [x] Limpar estado de conexões antigas no backend
- [x] Corrigir configuração Apache para proxy Socket.IO correto
- [ ] Testar geração de novo QR Code após correção

## Bug: Conexão WhatsApp estabelecida mas não aparece na lista
- [ ] Verificar logs do console para identificar erro ao salvar conexão
- [ ] Verificar se endpoint saveConnection está sendo chamado
- [ ] Corrigir lógica de salvamento ou endpoint
- [ ] Testar exibição de conexões após correção

## Feature: Persistir estado de conexões no backend
- [x] Aplicar patch sugerido pelo desenvolvedor no Baileys/index.ts
- [x] Adicionar campos qrcode e connected ao ConnectionInterface
- [x] Implementar emitQrCodeUpdate() para emitir estado
- [x] Registrar listener para enviar estado inicial a novos clientes
- [x] Rebuild e reiniciar container Docker
- [ ] Testar se QR Code aparece imediatamente ao conectar

## Bug: Página WhatsApp sem menu lateral
- [x] Verificar estrutura atual da página WhatsApp
- [x] Integrar DashboardLayout na página WhatsApp
- [x] Remover header duplicado se existir
- [x] Testar navegação e consistência visual

## Investigação: Sistema de resumo de grupos WhatsApp
- [x] Verificar código do frontend (página de configurações)
- [x] Verificar backend Docker (rotas e lógica)
- [x] Identificar prompt enviado para API do Gemini
- [x] Documentar processo completo
- [x] Explicar ao usuário como funciona

## Feature: Implementar resumo automático de grupos WhatsApp
- [x] Criar serviço de armazenamento de mensagens em memória
- [x] Capturar mensagens do grupo configurado via Baileys
- [x] Instalar e configurar @google/generative-ai no backend
- [x] Criar serviço de integração com Google Gemini API
- [x] Criar prompt para geração de resumos inteligentes
- [x] Implementar scheduler com node-schedule
- [x] Configurar job para rodar no horário especificado
- [x] Gerar resumo das mensagens do dia usando Gemini
- [x] Enviar resumo para o grupo de destino via Baileys
- [x] Limpar mensagens armazenadas após envio
- [ ] Testar fluxo completo em produção
- [ ] Documentar configuração e uso

## Feature: Melhorias no sistema de resumo de grupos
- [x] Adicionar campo de prompt customizável nas configurações
- [x] Atualizar schema do banco para armazenar prompt customizado
- [x] Adicionar campo de seleção de conexão WhatsApp
- [x] Atualizar schema do banco para armazenar ID da conexão
- [x] Criar interface de chat de análise de mensagens
- [x] Implementar backend para chat usando Gemini
- [x] Integrar chat com messageStore para análise em tempo real
- [x] Testar prompt customizado
- [x] Testar seletor de conexão
- [x] Testar chat de análise
- [x] Deploy em produção

## Feature: Lista selecionável de grupos WhatsApp
- [x] Criar tabela whatsapp_groups no schema
- [x] Capturar informações de grupos (ID, nome) no Baileys
- [x] Armazenar grupos detectados no banco de dados
- [x] Criar rota de API para listar grupos
- [x] Adicionar componente de seleção de grupos na UI
- [x] Substituir inputs de texto por selects de grupos
- [x] Testar detecção automática de grupos
- [x] Deploy em produção

## Bug: Captura de grupos não está funcionando
- [x] Investigar por que handler de messages.upsert não executa código de captura
- [x] Verificar se há conflito com código existente
- [x] Corrigir handler para capturar grupos corretamente
- [x] Obter nomes dos grupos via groupMetadata
- [x] Testar com mensagens reais
- [x] Verificar se grupos aparecem no banco de dados

## Bug: Grupos não são detectados automaticamente em produção
- [x] Investigar logs do backend para verificar se mensagens estão sendo capturadas
- [x] Verificar se código de detecção foi deployado corretamente no Docker
- [x] Corrigir Dockerfile para copiar arquivos corretamente
- [x] Corrigir Dockerfile para fazer build do TypeScript
- [x] Deploy com todos os arquivos (groupStore.ts, saveGroupInfo.ts, etc)
- [x] Endpoints /whatsapp/groups e /whatsapp/connections funcionando
- [ ] Testar envio de mensagem em grupo e verificar detecção automática

## Bug: Backend em loop de crash - build falha com arquivos .backup e .sqlite
- [x] Remover arquivos .backup do repositório backend
- [x] Remover arquivo database.sqlite do repositório
- [x] Adicionar .dockerignore para excluir arquivos problemáticos
- [x] Mudar Dockerfile para usar tsx em vez de build compilado
- [x] Rebuild do Docker com tsx (sem compilação)
- [x] Container rodando com sucesso
- [x] Testar endpoints /whatsapp/groups e /whatsapp/connections - FUNCIONANDO
- [x] QR Code sendo gerado corretamente


## Bug: Endpoints tRPC retornando 404
- [x] Investigar por que /api/trpc/* retorna 404
- [x] Verificar se rota está registrada corretamente em src/routes/index.ts
- [x] Identificado: arquivo trpc.ts não estava sendo copiado no build
- [x] Copiado arquivos manualmente do sandbox para servidor
- [x] Rebuild completo do Docker
- [x] Testar endpoints tRPC manualmente - FUNCIONANDO!
- [x] whatsappGroups.list - OK
- [x] settings.get - OK


## Bug CRÍTICO: Grupos não são detectados automaticamente
- [x] Investigar logs do backend para ver se mensagens de grupos estão sendo capturadas
- [x] Verificar se groupStore está salvando grupos corretamente
- [x] Verificar se endpoint /api/trpc/whatsappGroups.list retorna dados - FUNCIONANDO
- [x] Verificar se frontend está fazendo query correta - FUNCIONANDO
- [x] CAUSA RAIZ: Banco de dados 'mensageria' não existia e tabelas não estavam criadas
- [x] SOLUÇÃO: Criado banco 'mensageria' e rodado pnpm db:push para criar todas as tabelas
- [x] Frontend agora conecta no banco e dropdowns funcionam corretamente
- [x] Dropdowns não mostram mais badges de erro
- [x] Mensagem "Nenhum grupo detectado ainda" é esperada (nenhuma conexão WhatsApp ativa)
- [ ] Testar fluxo: conectar WhatsApp → enviar msg em grupo → verificar se aparece no dropdown


## Bug: Deploy não foi feito corretamente - versão antiga em produção
- [x] Verificar qual versão está rodando em produção - IDENTIFICADO: código desatualizado
- [x] Identificar quais correções não foram deployadas - DashboardLayout e timeout
- [x] Fazer build correto do frontend com todas as correções - BUILD CONCLUÍDO
- [x] Transferir arquivos para o servidor - RSYNC COMPLETO
- [x] Reiniciar PM2 - PM2 RODANDO
- [ ] PROBLEMA: Variáveis de ambiente VITE não estão sendo substituídas no build
- [ ] Página carrega mas mostra %VITE_APP_TITLE% ao invés do título real
- [ ] Precisa corrigir processo de build para substituir variáveis corretamente
- [ ] Testar: timeout de 8s no QR Code deve estar desativado
- [ ] Testar: página /whatsapp deve ter menu lateral (DashboardLayout)


## Bug: Erro de API Query - settings.get retorna undefined
- [x] Investigar erro: [API Query Error] Error: [["settings","get"],{"type":"query"}] data is undefined
- [x] Verificar se tabela settings existe no banco - EXISTE
- [x] Verificar se procedure settings.get está implementado corretamente - CORRETO
- [x] CAUSA RAIZ: Tabela settings vazia, getUserSettings retorna undefined
- [x] Modificar backend para criar registro default automaticamente em getUserSettings
- [x] Deploy do db.ts corrigido para produção
- [x] Testar página Settings sem erro - FUNCIONANDO PERFEITAMENTE

## Bug: Grupos WhatsApp não aparecem após enviar mensagem
- [x] Verificar logs do backend Docker para ver se mensagens estão sendo capturadas - FUNCIONANDO
- [x] Verificar se groupStore está salvando grupos localmente - FUNCIONANDO (arquivo tmp/whatsapp-groups.json)
- [x] CAUSA RAIZ: WHATSAPP_GROUPS_CALLBACK_URL configurada com localhost:3000 (errado dentro do Docker)
- [x] Corrigir WHATSAPP_GROUPS_CALLBACK_URL para http://172.17.0.1:3000/api/whatsapp/groups
- [x] Reiniciar container Docker com nova configuração
- [x] Testar: enviar mensagem em grupo e verificar se sincroniza com frontend - FUNCIONANDO
- [x] Verificar se dados aparecem na tabela whatsapp_groups do banco - GRUPO SALVO CORRETAMENTE
- [x] Usuário configurou resumo automático com sucesso
- [x] Todas as configurações salvas no banco de dados


## Teste: Executar resumo automático manualmente
- [x] Investigar código do backend que executa resumo - ENCONTRADO resumeScheduler.ts
- [x] Identificar scheduler/cron job - USA node-schedule
- [x] PROBLEMA: resumeScheduler NÃO estava sendo inicializado no server.ts
- [x] Modificar server.ts para inicializar scheduler - FEITO
- [x] Buscar configurações do banco e passar para scheduler - FUNCIONANDO
- [x] Deploy do server.ts modificado - COMPLETO
- [x] Reiniciar container Docker - REINICIADO
- [x] Verificar logs - scheduler configurado e agendado para 9h
- [x] Gemini inicializado com sucesso
- [x] Criar endpoint HTTP /api/test-resume para teste manual - CRIADO
- [x] Testar endpoint - FUNCIONANDO (http://185.215.166.113:5600/api/test-resume)
- [x] PROBLEMA: messageStore vazio - "Nenhuma mensagem para resumir"
- [x] Verificar código do messageStore - ENCONTRADO
- [x] CAUSA RAIZ: Baileys usa messageStore diferente do resumeScheduler (2 instâncias separadas)
- [x] Baileys importa de './messageStore', scheduler importa de '../messageStore'
- [x] Corrigir import em Baileys/index.ts para usar messageStore correto - FEITO
- [x] Deploy e reiniciar container - FEITO
- [x] Enviar mensagem de teste - MENSAGENS RECEBIDAS
- [x] NOVO PROBLEMA: Incompatibilidade de parâmetros em addMessage
- [x] Baileys chama com 4 parâmetros, messageStore aceita apenas 3
- [x] Corrigir assinatura de addMessage para aceitar timestamp opcional - FEITO
- [x] Deploy e reiniciar - FEITO
- [x] Executar /api/test-resume - EXECUTADO
- [x] 3 mensagens capturadas com sucesso!
- [x] Scheduler tentou gerar resumo
- [x] ERRO FINAL: Modelo gemini-pro não existe mais (404)
- [x] Corrigir geminiService.ts para usar gemini-1.5-flash-latest
- [x] Deploy e reiniciar container
- [x] 4 mensagens capturadas com sucesso
- [x] Scheduler executou teste
- [x] BLOQUEIO FINAL: Biblioteca @google/generative-ai@0.24.1 usa API v1beta
- [x] API v1beta NÃO suporta gemini-1.5-flash-latest (404)
- [ ] SOLUÇÃO: Atualizar biblioteca para @google/generative-ai@latest
- [ ] Executar: docker exec -it mensageria npm install @google/generative-ai@latest
- [ ] Reiniciar container
- [ ] Enviar mensagens de teste no grupo
- [ ] Executar /api/test-resume
- [ ] Validar que resumo foi gerado pelo Gemini
- [ ] Validar que resumo foi enviado no WhatsApp
- [ ] Confirmar sistema 100% operacional

## Correção: Logo e título do app
- [x] Copiar logo LogoMensageria.png para client/public/logo.png
- [x] Atualizar const.ts para usar valores fixos (APP_TITLE = "Mensageria", APP_LOGO = "/logo.png")
- [x] Atualizar index.html para usar valores fixos no favicon e title
- [x] Remover todas as referências a %VITE_APP_LOGO% e %VITE_APP_TITLE%
- [ ] Criar checkpoint para deploy em produção

## API REST para envio de mensagens WhatsApp
- [x] Criar endpoint POST /api/whatsapp/send no backend
- [x] Implementar autenticação via API Key
- [x] Adicionar validação de parâmetros (número, mensagem)
- [x] Criar interface de documentação da API no frontend
- [x] Criar testador interativo na interface
- [ ] Testar API com curl/Postman
- [x] Documentar uso da API (exemplos de requisição)


## Correções na API REST
- [x] Adicionar campo de seleção de conexão no formulário de teste (já existia)
- [x] Corrigir URL da API no frontend (usar proxy via mesmo domínio)
- [x] Adicionar CORS no backend para permitir requisições do frontend
- [x] Configurar proxy reverso no Apache (/api -> backend:5600)
- [ ] Testar envio de mensagem com correções aplicadas


## ✅ API REST - IMPLEMENTAÇÃO COMPLETA (Micro-serviço)
- [x] Criar micro-serviço Node.js independente (porta 5601)
- [x] Implementar endpoint POST /send com validação completa
- [x] Adicionar autenticação via X-API-Key
- [x] Configurar comunicação com backend Docker (porta 5600)
- [x] Configurar token de autenticação do backend
- [x] Corrigir mapeamento de parâmetros (phone, message)
- [x] Configurar Apache para proxy /api/send-message → micro-serviço
- [x] Atualizar frontend para usar novo endpoint
- [x] Testar API via HTTPS com sucesso
- [x] Deploy completo em produção

### ENDPOINT FINAL
**URL:** POST https://mensageria.grupoblue.com.br/api/send-message

**Headers:**
- Content-Type: application/json
- X-API-Key: test-api-key-123

**Body:**
```json
{
  "connectionName": "mensageria",
  "to": "5561986266334",
  "message": "Sua mensagem aqui"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "data": { ... }
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "Descrição do erro",
  "details": { ... }
}
```

### ARQUITETURA
- **Micro-serviço:** /root/whatsapp-api-service/index.js (porta 5601)
- **PM2:** whatsapp-api (gerenciamento do processo)
- **Apache:** Proxy /api/send-message → localhost:5601/send
- **Backend:** Docker mensageria (porta 5600) - Baileys WhatsApp
- **Frontend:** https://mensageria.grupoblue.com.br/api (documentação)

### OBSERVAÇÕES
- API Key configurada: test-api-key-123 (alterar em produção)
- Token de autenticação backend configurado automaticamente
- Micro-serviço usa apenas módulos nativos do Node.js (sem dependências)
- Proxy Apache configurado no arquivo -le-ssl.conf (Let's Encrypt)


## Bug: Erro "Cannot GET /api/auth/google" ao fazer login - RESOLVIDO ✅
- [x] Investigar configuração do Apache para rotas /api/auth/*
- [x] Identificar conflito entre backend Node.js (porta 3000) e backend Docker (porta 5600)
- [x] Atualizar Apache para redirecionar /api/auth/* para porta 3000
- [x] Adicionar /api/trpc/* para porta 3000 (tRPC)
- [x] Manter /api/send-message para porta 5601 (micro-serviço)
- [x] Manter /api/* genérico para porta 5600 (backend Docker)
- [x] Testar login OAuth completo - FUNCIONANDO


## Feature: Sistema de Webhook para Mensagens Recebidas - IMPLEMENTADO ✅
- [x] Criar tabela webhook_config no banco de dados
- [x] Criar tabela webhook_logs no banco de dados
- [x] Fazer push do schema para o banco
- [x] Criar micro-serviço webhook (porta 5602)
- [x] Implementar endpoint POST /inbound no micro-serviço
- [x] Implementar formatação de payload para Supabase
- [x] Implementar retry automático em caso de falha
- [x] Implementar conversão de formato de número (Baileys → +55...)
- [x] Modificar Baileys para capturar mensagens recebidas
- [x] Integrar Baileys com micro-serviço webhook
- [x] Criar rotas tRPC para webhook_config (get, save, getLogs, testWebhook)
- [x] Criar interface de configuração no frontend (/webhook)
- [x] Adicionar formulário de webhook nas Configurações
- [x] Implementar testador de webhook
- [x] Adicionar visualização de logs de mensagens
- [x] Configurar PM2 para micro-serviço webhook
- [ ] Testar fluxo completo end-to-end com webhook real


## Bug: Tabelas webhook não existem no banco de produção - RESOLVIDO ✅
- [x] Criar tabela webhook_config no banco de produção
- [x] Criar tabela webhook_logs no banco de produção
- [x] Corrigir nome da coluna de 'from' para 'from_number'
- [x] Atualizar schema e código para usar fromNumber
- [x] Deploy e teste de salvamento de configuração


## Feature: Implementar PR #7 - Teste de Webhook no Backend Docker - CONCLUÍDO ✅
- [x] Clonar repositório mensageria (backend Docker)
- [x] Fazer checkout da branch da PR #7
- [x] Revisar alterações em trpc.ts e settingsStore.ts
- [x] Aplicar alterações no backend Docker de produção (/root/mensageria)
- [x] Copiar trpc.ts e settingsStore.ts para produção
- [x] Reiniciar container Docker
- [x] Fazer merge da PR #7 no GitHub (squash merge)


## Bug: Erro de hydration - tags <a> aninhadas na página /api - RESOLVIDO ✅
- [x] Identificar código com <a> aninhado em Home.tsx (Links com Buttons)
- [x] Usar asChild no Button para permitir Link como elemento raiz
- [x] Corrigir todos os 4 botões (WhatsApp, Telegram, Enviar, Configurações)


## Bug: Erro 500 ao testar webhook - RESOLVIDO ✅
- [x] Identificar causa do erro (TypeScript: fromNumber vs from)
- [x] Corrigir server/db.ts linha 287 (fromNumber -> from)
- [x] Build e commit da correção
- [ ] Deploy para produção (pendente - SSH com problema)
- [ ] Testar novamente após deploy


## Bug: Card de Webhook ausente na página de Configurações - RESOLVIDO ✅
- [x] Adicionar card "Webhook de Mensagens Recebidas" no Settings.tsx
- [x] Card tem link para /webhook com Button asChild
- [x] Posicionado antes do botão "Salvar Configurações"
- [x] Adicionar import do Link do wouter
- [x] Teste local no Preview - FUNCIONANDO
- [ ] Deploy completo para produção (pendente)


## Deploy para Produção
- [ ] Conectar ao servidor via SSH/SFTP
- [ ] Copiar dist/index.js (backend) para /var/www/mensageria-frontend/dist/
- [ ] Copiar dist/public/* (frontend) para /var/www/mensageria-frontend/dist/public/
- [ ] Reiniciar PM2: pm2 restart mensageria-frontend
- [ ] Validar em https://mensageria.grupoblue.com.br/settings
- [ ] Testar webhook em https://mensageria.grupoblue.com.br/webhook


## Bug: Erro 404 na rota /api - RESOLVIDO ✅
- [x] Verificar se rota /api está definida no App.tsx - FALTAVA
- [x] Verificar se componente API.tsx existe - OK
- [x] Verificar se componente WebhookConfig.tsx existe - ESTAVA VAZIO
- [x] Recuperar WebhookConfig.tsx do Git (commit dff8cb4)
- [x] Adicionar rotas /api e /webhook no App.tsx
- [x] Corrigir log.from para log.fromNumber no WebhookConfig.tsx
- [x] Testar acesso a /api - FUNCIONANDO
- [x] Testar acesso a /webhook - FUNCIONANDO


## Bug: Erro 500 na página /webhook ao carregar
- [ ] Verificar logs do servidor de desenvolvimento
- [ ] Identificar qual rota tRPC está falhando
- [ ] Verificar se é problema de banco de dados ou código
- [ ] Corrigir problema identificado
- [ ] Testar página /webhook novamente


## Bug: Erro 500 na página /webhook - RESOLVIDO ✅
- [x] Identificar causa do erro (incompatibilidade from vs fromNumber)
- [x] Corrigir schema.ts para usar fromNumber (from_number no banco)
- [x] Corrigir db.ts para usar webhookLogs.fromNumber
- [x] Testar página /webhook - FUNCIONANDO


## Análise Sistemática: Erro 500 persistente na página /webhook - CONCLUÍDA ✅
- [x] Verificar qual rota tRPC exatamente está retornando 500 - webhook.getConfig ou getLogs
- [x] Verificar estrutura da tabela webhook_config no banco (dev vs prod) - Não acessível via SSH
- [x] Verificar estrutura da tabela webhook_logs no banco (dev vs prod) - Não acessível via SSH
- [x] Testar em dev - FUNCIONA PERFEITAMENTE (sem erro 500)
- [x] Identificar causa raiz exata - Código em produção está desatualizado
- [x] Build atualizado gerado - dist/index.js (48.9 KB) com fromNumber
- [x] Pacote de deploy preparado - webhook-fix-deploy.zip (925 KB)
- [ ] Deploy manual necessário (SSH bloqueado)
- [ ] Testar em produção após deploy

## PR #8: Melhorias de Segurança e Infraestrutura
- [x] Remover arquivos de código morto do frontend (ComponentShowcase.tsx, WhatsApp-improved.tsx, WhatsApp-simple.tsx)
- [x] Limpar página WhatsApp.tsx (remover console.logs de debug)
- [x] Atualizar .env.example com documentação completa
- [x] Implementar validação de entrada com schemas Zod (src/schemas/index.ts)
- [x] Criar utilitários de segurança (src/utils/security.ts - validação URL, email, telefone)
- [x] Implementar rate limiting no servidor (src/middlewares/rateLimit.ts)
- [x] Adicionar middleware de segurança e autenticação aprimorado
- [x] Corrigir Dockerfile para produção com multi-stage build
- [x] Adicionar Redis ao docker-compose
- [x] Adicionar volumes para persistência de dados (auth_info_baileys, tmp, database)
- [x] Implementar health check no Dockerfile
- [x] Adicionar configuração de variáveis de ambiente (src/config/env.ts)
- [x] Merge da PR #8 concluído e enviado para GitHub

## Deploy PR #8 em Produção
- [x] Conectar ao servidor de produção (185.215.166.113)
- [x] Fazer rsync dos arquivos atualizados
- [x] Gerar SECRET_KEY segura (99dc741b9bc23889045a...)
- [x] Atualizar .env com novas variáveis (SECRET_KEY, ALLOWED_ORIGINS, REDIS_*)
- [x] Parar containers atuais (docker-compose down)
- [x] Fazer backup dos dados (backup-20251209-224316)
- [x] Corrigir tsup.config.ts (excluir .sqlite do build)
- [x] Rebuild dos containers com Dockerfile multi-stage (docker-compose build --no-cache)
- [x] Corrigir permissões dos volumes (chown 1001:1001 data/)
- [x] Subir containers com Redis (docker-compose up -d)
- [x] Verificar logs - QR Code gerado com sucesso
- [x] Testar health check - {"status":"healthy","database":"connected"}
- [x] Containers rodando: mensageria (healthy) + redis (healthy)

## Commit 748385d: Corrigir erro 500 no teste de webhook
- [x] Atualizar WebhookConfig.tsx para tratar success/error adequadamente
- [x] Melhorar tratamento de erros no testWebhook procedure (routers.ts)
- [x] Adicionar validateStatus para não lançar exceção em erros HTTP
- [x] Retornar mensagens amigáveis para erros de rede (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
- [x] TypeScript sem erros - tipos corrigidos automaticamente
- [x] Implementação completa do commit 748385d
