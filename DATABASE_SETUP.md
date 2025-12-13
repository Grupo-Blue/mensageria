# Configuração do Banco de Dados MySQL

## Erro: ECONNREFUSED

Se você está recebendo o erro `ECONNREFUSED` ao tentar conectar ao banco de dados, isso significa que o MySQL não está rodando ou não está acessível.

## Solução: Instalar e Iniciar MySQL

### Opção 1: Usando Homebrew (Recomendado para macOS)

1. **Instalar MySQL:**
   ```bash
   brew install mysql
   ```

2. **Iniciar MySQL:**
   ```bash
   brew services start mysql
   ```

3. **Verificar se está rodando:**
   ```bash
   brew services list | grep mysql
   ```
   Deve mostrar `mysql started`

4. **Configurar senha do root (se necessário):**
   ```bash
   mysql_secure_installation
   ```
   Ou definir a senha diretamente:
   ```bash
   mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'password';"
   ```

5. **Criar o banco de dados:**
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS mensageria;"
   ```

### Opção 2: Usando Docker (Alternativa)

1. **Iniciar MySQL com Docker:**
   ```bash
   docker run -d \
     --name mysql-mensageria \
     -p 3306:3306 \
     -e MYSQL_ROOT_PASSWORD=password \
     -e MYSQL_DATABASE=mensageria \
     mysql:8
   ```

2. **Verificar se está rodando:**
   ```bash
   docker ps | grep mysql
   ```

3. **Acessar o MySQL:**
   ```bash
   docker exec -it mysql-mensageria mysql -u root -p
   ```

### Opção 3: MySQL via Homebrew (Alternativa)

Se você já tem MySQL instalado mas não está rodando:

```bash
# Verificar status
brew services list | grep mysql

# Iniciar
brew services start mysql

# Parar
brew services stop mysql

# Reiniciar
brew services restart mysql
```

## Configurar o arquivo .env

Após instalar e iniciar o MySQL, configure o arquivo `.env` na raiz do projeto:

```env
DATABASE_URL=mysql://root:password@localhost:3306/mensageria
```

**Importante:** Substitua `password` pela senha que você configurou para o usuário `root`.

## Verificar a Conexão

Após configurar, reinicie o servidor e você deve ver:

```
[Database] Attempting to connect to MySQL: { host: 'localhost', port: 3306, ... }
[Database] Connected successfully to: mensageria
```

## Executar Migrações

Após conectar ao banco, execute as migrações para criar as tabelas:

```bash
# Na raiz do projeto
pnpm db:push
# ou
yarn db:push
```

## Troubleshooting

### Erro: "Access denied for user 'root'@'localhost'"

**Solução:** Verifique se a senha no `.env` está correta:
```bash
mysql -u root -p
```

### Erro: "Unknown database 'mensageria'"

**Solução:** Crie o banco de dados:
```bash
mysql -u root -p -e "CREATE DATABASE mensageria;"
```

### Erro: "Can't connect to MySQL server"

**Solução:** Verifique se o MySQL está rodando:
```bash
# Homebrew
brew services list | grep mysql

# Docker
docker ps | grep mysql

# Verificar porta
lsof -i :3306
```

### MySQL não inicia

**Solução:** Verifique os logs:
```bash
# Homebrew
brew services info mysql

# Docker
docker logs mysql-mensageria
```

## Comandos Úteis

```bash
# Conectar ao MySQL
mysql -u root -p

# Listar bancos de dados
mysql -u root -p -e "SHOW DATABASES;"

# Ver tabelas do banco mensageria
mysql -u root -p -e "USE mensageria; SHOW TABLES;"

# Verificar usuários
mysql -u root -p -e "SELECT user, host FROM mysql.user;"
```

## Próximos Passos

1. ✅ Instalar MySQL
2. ✅ Iniciar MySQL
3. ✅ Criar banco de dados `mensageria`
4. ✅ Configurar `DATABASE_URL` no `.env`
5. ✅ Executar migrações: `pnpm db:push`
6. ✅ Reiniciar o servidor
7. ✅ Testar login com Google OAuth

