from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(
            f"Variável de ambiente obrigatória '{key}' não definida.\n"
            f"Copie o .env.example para .env e preencha suas chaves."
        )
    return val


def _optional(key: str, default: str = "") -> str:
    return os.getenv(key, default)


# API Keys
GEMINI_API_KEY = _require("GEMINI_API_KEY")
HEYGEN_API_KEY = _require("HEYGEN_API_KEY")
TELEGRAM_BOT_TOKEN = _optional("TELEGRAM_BOT_TOKEN", "")

# IDs de voz e avatar (Heygen)
HEYGEN_AVATAR_ID = _optional("HEYGEN_AVATAR_ID", "583ffb7fc260465797576f858ceb71d4")
HEYGEN_VOICE_ID  = _optional("HEYGEN_VOICE_ID",  "583ffb7fc260465797576f858ceb71d4")

# Frases fixas
OPENING_PHRASE = (
    "Oi eu sou o Avatar do Carlos, enquanto ele foca em transformar "
    "e acelerar os negócios eu trago as novidades aqui..."
)
CLOSING_PHRASE = "Quer ajuda pra acelerar ou transformar o seu negócio? Fala com a gente!"

# Configurações de vídeo
OUTPUT_RESOLUTION = (1080, 1920)
OUTPUT_FPS = 30
VIDEO_FORMATS = {
    "stories": (1080, 1920),
    "reels": (1080, 1920),
    "tiktok": (1080, 1920),
}

# Diretórios
OUTPUT_DIR = Path(_optional("OUTPUT_DIR", "output"))
TEMP_DIR = Path(".tmp")

# Heygen
HEYGEN_POLL_INTERVAL_SEC = 15
HEYGEN_TIMEOUT_SEC = 600  # 10 minutos

# Gemini
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_IMAGEN_MODEL = "imagen-3.0-generate-002"
GEMINI_VEO_MODEL = "veo-2.0-generate-001"
