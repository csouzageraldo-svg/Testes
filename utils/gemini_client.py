"""
Cliente Gemini compartilhado com auto-descoberta de modelo disponível.
"""
from google import genai

from config import settings

_client: genai.Client | None = None
_active_model: str | None = None

# Candidatos em ordem de preferência
_CANDIDATE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-pro",
]


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def get_model() -> str:
    """Retorna o modelo Gemini disponível para esta chave API."""
    global _active_model
    if _active_model:
        return _active_model

    # Usa o modelo configurado se disponível
    configured = settings.GEMINI_MODEL
    client = get_client()

    # Tenta o modelo configurado primeiro
    candidates = [configured] + [m for m in _CANDIDATE_MODELS if m != configured]

    for model in candidates:
        try:
            client.models.generate_content(
                model=model,
                contents="ok",
            )
            _active_model = model
            print(f"[Gemini] Modelo ativo: {model}")
            return _active_model
        except Exception:
            continue

    # Última tentativa — retorna o configurado e deixa falhar com erro claro
    _active_model = configured
    return _active_model
