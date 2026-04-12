"""
Cliente Gemini compartilhado — força API v1 (v1beta não suporta gemini-1.5-flash).
"""
from google import genai
from google.genai import types

from config import settings

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(api_version="v1"),
        )
    return _client
