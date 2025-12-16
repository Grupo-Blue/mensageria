# Configuração de Deploy Automático

Este projeto está configurado com GitHub Actions para deploy automático quando há push na branch `master`.

## 📋 Pré-requisitos

1. Acesso ao servidor via SSH
2. Git instalado no servidor
3. Node.js 20+ instalado no servidor
4. pnpm instalado no servidor
5. (Opcional) Docker e Docker Compose se usar containers

## 🔧 Configuração no GitHub

### 1. Acessar Secrets do Repositório

1. Vá para o repositório no GitHub
2. Clique em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret**

### 2. Adicionar os Segredos Necessários

Adicione os seguintes secrets:

#### `DEPLOY_HOST`
- **Descrição**: IP ou domínio do servidor de produção
- **Exemplo**: `192.168.1.100` ou `servidor.exemplo.com`

#### `DEPLOY_USER`
- **Descrição**: Usuário SSH do servidor
- **Exemplo**: `deploy` ou `ubuntu` ou `root`

#### `DEPLOY_SSH_KEY`
- **Descrição**: Chave SSH privada para acesso ao servidor
- **Como gerar**:
  ```bash
  # No seu servidor
  ssh-keygen -t ed25519 -C "github-actions"
  
  # Copiar a chave privada (mostrar conteúdo)
  cat ~/.ssh/id_ed25519
  ```
- **Importante**: Copie TODO o conteúdo, incluindo `-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`

#### `DEPLOY_PORT` (Opcional)
- **Descrição**: Porta SSH (padrão: 22)
- **Exemplo**: `22` ou `2222`

#### `DEPLOY_PATH` (Opcional)
- **Descrição**: Caminho no servidor onde o projeto está instalado
- **Exemplo**: `/var/www/mensageria` ou `/home/user/mensageria`
- **Padrão**: Se não especificado, será usado o diretório atual do SSH

### 3. Adicionar Chave SSH Pública ao Servidor

Depois de gerar a chave SSH, adicione a chave pública ao servidor:

```bash
# No servidor, adicione a chave pública ao authorized_keys
echo "SUA_CHAVE_PUBLICA_AQUI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 🚀 Métodos de Deploy

O workflow suporta múltiplos métodos. Configure apenas o que você usa:

### Opção 1: PM2 (Recomendado para Node.js)

Se você usa PM2 para gerenciar o processo Node.js:

```bash
# No servidor, instale PM2 globalmente
npm install -g pm2

# Inicie o aplicativo
cd /var/www/mensageria
pm2 start dist/index.js --name mensageria
pm2 save
pm2 startup  # Para iniciar automaticamente no boot
```

### Opção 2: Docker Compose

Se você usa Docker:

```bash
# No servidor, certifique-se de que o docker-compose.yml está configurado
# O workflow irá executar: docker-compose down && docker-compose up -d --build
```

### Opção 3: Systemd

Se você usa systemd:

```bash
# Criar arquivo de serviço: /etc/systemd/system/mensageria.service
# O workflow irá executar: systemctl restart mensageria.service
```

## 📝 Configuração do Servidor

### 1. Preparar Diretório no Servidor

```bash
# Conectar ao servidor
ssh usuario@servidor

# Criar diretório do projeto (se não existir)
sudo mkdir -p /var/www/mensageria
sudo chown $USER:$USER /var/www/mensageria

# Clonar o repositório (se for primeira vez)
cd /var/www/mensageria
git clone https://github.com/Grupo-Blue/mensageria.git .
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo .env.example
cp .env.example .env

# Editar com suas configurações
nano .env
```

### 3. Instalar Dependências

```bash
# Instalar pnpm se não tiver
npm install -g pnpm

# Instalar dependências
pnpm install

# Build do projeto
pnpm build
```

### 4. Configurar Permissões

```bash
# Dar permissões adequadas
chmod +x dist/index.js
```

## 🔄 Como Funciona

1. **Push para master**: Quando você faz push na branch `master`, o workflow é acionado automaticamente
2. **Build**: O GitHub Actions faz build do projeto
3. **Deploy**: Conecta ao servidor via SSH e:
   - Faz pull das mudanças
   - Instala dependências
   - Faz build
   - Reinicia os serviços

## 🧪 Testar o Deploy

### Execução Manual

Você pode executar o workflow manualmente:

1. Vá para **Actions** no GitHub
2. Selecione **Deploy to Production**
3. Clique em **Run workflow**

### Logs

Para ver os logs do deploy:
1. Vá para **Actions** no GitHub
2. Clique no workflow executado
3. Veja os logs de cada step

## ⚠️ Troubleshooting

### Erro de Autenticação SSH

- Verifique se a chave SSH está correta
- Certifique-se de que a chave pública está no `authorized_keys` do servidor
- Teste a conexão manualmente: `ssh -i chave_privada usuario@servidor`

### Erro de Permissões

- Verifique se o usuário SSH tem permissões no diretório do projeto
- Verifique se o usuário pode executar PM2/Docker/systemctl

### Build Falha

- Verifique os logs no GitHub Actions
- Verifique se todas as variáveis de ambiente estão configuradas
- Teste o build localmente: `pnpm build`

### Serviço Não Reinicia

- Verifique se PM2/Docker/systemd está configurado corretamente
- Verifique os logs do serviço: `pm2 logs` ou `docker-compose logs`

## 📚 Recursos Adicionais

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SSH Action Documentation](https://github.com/appleboy/ssh-action)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
