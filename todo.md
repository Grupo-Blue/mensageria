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
