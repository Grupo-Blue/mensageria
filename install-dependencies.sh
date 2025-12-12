#!/bin/bash

# Script de instalação de dependências para macOS
# Este script instala Homebrew, Node.js, npm e pnpm

set -e  # Para o script se houver erro

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
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
        eval "$(/opt/homebrew/bin/brew shellenv)"
    # Para Intel Mac
    elif [[ -f "/usr/local/bin/brew" ]]; then
        echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
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

echo ""

# Verificar e instalar pnpm
echo "📦 Verificando pnpm..."
if ! command_exists pnpm; then
    echo -e "${YELLOW}pnpm não encontrado. Instalando...${NC}"
    npm install -g pnpm
    echo -e "${GREEN}✓ pnpm instalado com sucesso!${NC}"
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

