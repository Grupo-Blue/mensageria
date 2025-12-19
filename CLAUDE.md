# Regras de Projeto - Sistema de Mensageria

## Arquitetura do Projeto

### Estrutura de Diretórios Obrigatória

A arquitetura do projeto **DEVE** seguir a seguinte estrutura:

```
/
├── frontend/          # Frontend React (pasta obrigatória)
│   ├── client/       # Aplicação React
│   ├── server/       # Servidor Express com tRPC
│   └── shared/       # Código compartilhado TypeScript
│
├── backend/          # Backend Docker (pasta obrigatória)
│   ├── src/          # Código fonte do backend
│   └── Dockerfile    # Dockerfile do backend
│
└── drizzle/          # Schema e migrations do banco de dados
    ├── schema.ts     # Definição do schema
    ├── relations.ts  # Relações entre tabelas
    └── migrations/   # Migrations SQL geradas
```

**IMPORTANTE:**
- ✅ **SEMPRE** manter a separação entre `frontend/` e `backend/`
- ✅ **NUNCA** misturar código do frontend no backend ou vice-versa
- ✅ **SEMPRE** usar a pasta `frontend/` para código React/Express
- ✅ **SEMPRE** usar a pasta `backend/` para código do serviço Docker

## Migrations e Banco de Dados

### Regra Obrigatória: Toda Tabela Deve Ter Migration

**TODA** nova tabela ou alteração de schema **DEVE** ser adicionada no Drizzle para migration:

1. **Definir no Schema Drizzle:**
   - ✅ Adicionar a tabela em `drizzle/schema.ts` (ou arquivo de schema apropriado)
   - ✅ Definir todas as colunas, tipos e constraints
   - ✅ Adicionar relações em `drizzle/relations.ts` se necessário

2. **Gerar Migration:**
   - ✅ Executar `pnpm db:push` ou `yarn db:push` para gerar a migration
   - ✅ A migration será criada automaticamente em `drizzle/migrations/`

3. **Aplicar Migration:**
   - ✅ A migration será aplicada automaticamente pelo comando `db:push`
   - ✅ Verificar se a migration foi criada corretamente

**NUNCA:**
- ❌ Criar tabelas diretamente no banco sem migration
- ❌ Modificar tabelas existentes sem atualizar o schema Drizzle
- ❌ Pular a etapa de migration ao adicionar novas tabelas

### Exemplo de Workflow Correto:

```typescript
// 1. Adicionar no drizzle/schema.ts
export const minhaNovaTabela = mysqlTable('minha_nova_tabela', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Executar migration
// pnpm db:push

// 3. Usar no código
import { minhaNovaTabela } from '../drizzle/schema';
```

## Convenções de Código

### TypeScript
- ✅ **SEMPRE** usar TypeScript em todo o código
- ✅ **SEMPRE** definir tipos explícitos quando necessário
- ✅ **NUNCA** usar `any` sem justificativa

### Imports e Organização
- ✅ **SEMPRE** usar imports relativos corretos baseados na estrutura de pastas
- ✅ **SEMPRE** manter imports organizados (externos primeiro, depois internos)

### Comentários e Documentação
- ✅ **NUNCA** deixar código TODO ou comentários de "para fazer"
- ✅ **SEMPRE** completar toda a tarefa antes de finalizar
- ✅ **SEMPRE** documentar funções complexas

## Estrutura de API

### tRPC Routers
- ✅ **SEMPRE** criar routers no diretório apropriado (`server/routers/`)
- ✅ **SEMPRE** usar `protectedProcedure` para endpoints que requerem autenticação
- ✅ **SEMPRE** validar inputs com Zod schemas

### Banco de Dados
- ✅ **SEMPRE** usar Drizzle ORM para queries
- ✅ **NUNCA** usar queries SQL raw sem necessidade
- ✅ **SEMPRE** usar transações para operações que modificam múltiplas tabelas

## Docker e Deploy

### Dockerfiles
- ✅ **SEMPRE** manter Dockerfiles separados para frontend e backend
- ✅ **SEMPRE** otimizar layers do Docker para cache eficiente
- ✅ **SEMPRE** usar variáveis de ambiente para configurações

### Docker Compose
- ✅ **SEMPRE** manter serviços organizados no `docker-compose.yml`
- ✅ **SEMPRE** usar networks apropriadas para comunicação entre serviços

## Testes

- ✅ **SEMPRE** escrever testes para funcionalidades críticas
- ✅ **SEMPRE** manter testes atualizados quando código muda

## Segurança

- ✅ **SEMPRE** validar e sanitizar inputs do usuário
- ✅ **SEMPRE** usar autenticação em endpoints protegidos
- ✅ **NUNCA** expor informações sensíveis em logs ou respostas de API
- ✅ **SEMPRE** usar variáveis de ambiente para secrets

## Resumo das Regras Críticas

1. ✅ **Arquitetura:** Manter separação clara entre `frontend/` e `backend/`
2. ✅ **Migrations:** Toda tabela DEVE ser adicionada no Drizzle antes de usar
3. ✅ **Código:** Nunca deixar TODOs, sempre completar a tarefa
4. ✅ **TypeScript:** Usar tipos explícitos e evitar `any`
5. ✅ **Segurança:** Validar inputs e usar autenticação adequada
