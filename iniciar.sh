#!/bin/bash
# Setup e inicialização do CGAvVid Bot — Mac/Linux

echo "🤖 CGAvVid Bot — Setup"
echo "======================"

# Verifica Python
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 não encontrado. Instale em https://python.org"
    exit 1
fi

# Instala dependências
echo "📦 Instalando dependências..."
pip3 install -r requirements.txt -q

# Cria .env se não existir
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  Arquivo .env criado. Preencha as chaves de API antes de continuar."
    echo "   Edite o arquivo .env com suas chaves e rode este script novamente."
    exit 0
fi

echo ""
echo "✅ Tudo pronto! Iniciando bot..."
echo "   Acesse t.me/CGAvVid_bot no Telegram"
echo "   Pressione Ctrl+C para parar"
echo ""
python3 bot_main.py
