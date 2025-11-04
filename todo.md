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
