# Configuração do Google OAuth

## Problema: Callback redirecionando para porta errada

Se você está sendo redirecionado para `http://localhost:3333/api/auth/google/callback` após fazer login, isso significa que a URL de callback configurada no Google Cloud Console está incorreta.

**Solução Temporária**: O backend agora tem um redirecionamento automático que redireciona o callback para o frontend (porta 3000). Isso funciona mesmo se o Google estiver redirecionando para a porta 3333.

## Solução Permanente (Recomendada)

### 1. Verificar a porta do servidor frontend

O servidor frontend roda na porta **3000** por padrão (não 3333). Verifique qual porta está sendo usada:

```bash
# Ao iniciar o servidor, você verá:
Server running on http://localhost:3000/
```

### 2. Atualizar a URL de callback no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Selecione seu projeto
3. Vá em **APIs e Serviços** > **Credenciais**
4. Clique no **ID do cliente OAuth 2.0** que você está usando
5. Em **URIs de redirecionamento autorizados**, adicione ou atualize:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. **Importante**: Se você tiver `http://localhost:3333/api/auth/google/callback` configurado, **remova** essa URL
7. Clique em **Salvar**

### 3. Configurar variável de ambiente (Opcional)

Se o servidor estiver rodando em uma porta diferente de 3000, configure a variável `FRONTEND_URL` no arquivo `.env`:

```env
FRONTEND_URL=http://localhost:3000
```

### 4. Reiniciar o servidor

Após fazer as alterações:

```bash
# Parar o servidor (Ctrl+C)
# Reiniciar
yarn dev
```

## Verificação

Após configurar corretamente, você deve ver no console ao iniciar o servidor:

```
[Google OAuth] Initializing with: {
  clientId: '...',
  callbackURL: 'http://localhost:3000/api/auth/google/callback',
  isProduction: false,
  baseUrl: 'http://localhost:3000'
}
```

## URLs de callback para diferentes ambientes

### Desenvolvimento
```
http://localhost:3000/api/auth/google/callback
```

### Produção
```
https://mensageria.grupoblue.com.br/api/auth/google/callback
```

## Troubleshooting

### Erro: "redirect_uri_mismatch"

Isso significa que a URL de callback no Google Cloud Console não corresponde à URL que está sendo usada. Verifique:

1. A URL exata no Google Cloud Console (sem espaços, sem trailing slash)
2. A porta do servidor (verifique no console ao iniciar)
3. Se está usando `http://` (não `https://`) em desenvolvimento

### Callback funcionando mas não redireciona

Se o callback está sendo processado mas não redireciona corretamente:

1. Verifique os logs do console para ver se há erros
2. Verifique se o banco de dados está configurado corretamente
3. Verifique se as variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão corretas

### Testar o callback manualmente

Você pode testar se a rota está funcionando acessando diretamente (sem autenticação, dará erro, mas confirma que a rota existe):

```
http://localhost:3000/api/auth/google/callback
```

Se você receber um erro do Passport (não "Cannot GET"), significa que a rota está configurada corretamente.

