@echo off
REM Setup e inicialização do CGAvVid Bot — Windows
echo.
echo  CGAvVid Bot - Setup
echo  ===================
echo.

REM Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERRO: Python nao encontrado.
    echo  Instale em https://python.org e marque "Add to PATH"
    pause
    exit /b 1
)

REM Instala dependencias
echo  Instalando dependencias...
pip install -r requirements.txt -q

REM Cria .env se nao existir
if not exist ".env" (
    copy .env.example .env
    echo.
    echo  ATENCAO: Arquivo .env criado.
    echo  Abra o arquivo .env, preencha suas chaves de API e rode novamente.
    pause
    exit /b 0
)

echo.
echo  Tudo pronto! Iniciando bot...
echo  Acesse t.me/CGAvVid_bot no Telegram
echo  Pressione Ctrl+C para parar
echo.
python bot_main.py
pause
