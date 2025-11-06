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
