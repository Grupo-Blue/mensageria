#!/bin/bash

# Script de instalação de dependências para macOS
# Este script instala Homebrew, Node.js, npm e pnpm

# Não usar set -e para permitir tratamento de erros personalizado

echo "🚀 Iniciando instalação de dependências..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar e instalar Homebrew
echo "📦 Verificando Homebrew..."
if ! command_exists brew; then
    echo -e "${YELLOW}Homebrew não encontrado. Instalando...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Adicionar Homebrew ao PATH (para Apple Silicon)
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        BREW_LINE='eval "$(/opt/homebrew/bin/brew shellenv)"'
        # Verificar se a linha já existe no .zshrc antes de adicionar
        if ! grep -qF "$BREW_LINE" ~/.zshrc 2>/dev/null; then
            echo "$BREW_LINE" >> ~/.zshrc
        fi
        eval "$(/opt/homebrew/bin/brew shellenv)"
    # Para Intel Mac
    elif [[ -f "/usr/local/bin/brew" ]]; then
        BREW_LINE='eval "$(/usr/local/bin/brew shellenv)"'
        # Verificar se a linha já existe no .zshrc antes de adicionar
        if ! grep -qF "$BREW_LINE" ~/.zshrc 2>/dev/null; then
            echo "$BREW_LINE" >> ~/.zshrc
        fi
        eval "$(/usr/local/bin/brew shellenv)"
    fi
    echo -e "${GREEN}✓ Homebrew instalado com sucesso!${NC}"
else
    echo -e "${GREEN}✓ Homebrew já está instalado${NC}"
fi

echo ""

# Verificar e instalar Node.js (que inclui npm)
echo "📦 Verificando Node.js e npm..."
if ! command_exists node; then
    echo -e "${YELLOW}Node.js não encontrado. Instalando...${NC}"
    brew install node
    echo -e "${GREEN}✓ Node.js e npm instalados com sucesso!${NC}"
else
    echo -e "${GREEN}✓ Node.js já está instalado${NC}"
    node --version
fi

if ! command_exists npm; then
    echo -e "${RED}Erro: npm não foi instalado corretamente${NC}"
    exit 1
fi

# Verificar e corrigir permissões do cache do npm
echo "🔧 Verificando permissões do cache do npm..."
NPM_CACHE_DIR="$HOME/.npm"
if [ -d "$NPM_CACHE_DIR" ]; then
    # Verificar se há arquivos com permissões incorretas
    if [ -n "$(find "$NPM_CACHE_DIR" -user root 2>/dev/null | head -1)" ]; then
        echo -e "${YELLOW}Corrigindo permissões do cache do npm...${NC}"
        USER_ID=$(id -u)
        GROUP_ID=$(id -g)
        sudo chown -R "$USER_ID:$GROUP_ID" "$NPM_CACHE_DIR" 2>/dev/null || {
            echo -e "${YELLOW}Aviso: Não foi possível corrigir automaticamente.${NC}"
            echo -e "${YELLOW}Execute manualmente: sudo chown -R $USER_ID:$GROUP_ID $NPM_CACHE_DIR${NC}"
        }
        echo -e "${GREEN}✓ Permissões do cache do npm corrigidas${NC}"
    else
        echo -e "${GREEN}✓ Permissões do cache do npm estão corretas${NC}"
    fi
fi

echo ""

# Verificar e instalar pnpm
echo "📦 Verificando pnpm..."
if ! command_exists pnpm; then
    echo -e "${YELLOW}pnpm não encontrado. Instalando...${NC}"
    # Usar o método oficial de instalação do pnpm (via curl) que não requer sudo
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    
    # Adicionar pnpm ao PATH
    PNPM_HOME="$HOME/.local/share/pnpm"
    if [ -d "$PNPM_HOME" ]; then
        PNPM_PATH_LINE='export PNPM_HOME="$HOME/.local/share/pnpm"'
        CASE_PATH_LINE='case ":$PATH:" in *":$PNPM_HOME:"*) ;; *) export PATH="$PNPM_HOME:$PATH" ;; esac'
        
        # Adicionar ao .zshrc se não existir
        if ! grep -qF "$PNPM_PATH_LINE" ~/.zshrc 2>/dev/null; then
            echo "" >> ~/.zshrc
            echo "$PNPM_PATH_LINE" >> ~/.zshrc
            echo "$CASE_PATH_LINE" >> ~/.zshrc
        fi
        
        # Carregar no shell atual
        export PNPM_HOME="$HOME/.local/share/pnpm"
        export PATH="$PNPM_HOME:$PATH"
    fi
    
    # Verificar se foi instalado corretamente
    if command_exists pnpm; then
        echo -e "${GREEN}✓ pnpm instalado com sucesso!${NC}"
    else
        echo -e "${YELLOW}Aviso: pnpm pode não estar no PATH. Tente fechar e reabrir o terminal.${NC}"
    fi
else
    echo -e "${GREEN}✓ pnpm já está instalado${NC}"
    pnpm --version
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Instalação concluída com sucesso!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "Versões instaladas:"
echo "  Node.js: $(node --version)"
echo "  npm:     $(npm --version)"
echo "  pnpm:    $(pnpm --version)"
echo ""
echo "💡 Dica: Se os comandos não funcionarem, feche e reabra o terminal"
echo "   ou execute: source ~/.zshrc"
echo ""

