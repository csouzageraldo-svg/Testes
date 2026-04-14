"""
Geração de vídeo com avatar via Heygen.
Usa a voz nativa do Heygen (voice_id configurado) — sem ElevenLabs.

Estratégia de avatar (em ordem de prioridade):
1. Talking Photo — se o usuário enviou uma foto, usa ela
2. Avatar configurado em HEYGEN_AVATAR_ID — se existir na conta
3. Primeiro avatar disponível na conta (auto-descoberto)
"""

import time
from pathlib import Path
from typing import Optional

import requests

from config import settings

HEYGEN_GENERATE_URL = "https://api.heygen.com/v2/video/generate"
HEYGEN_STATUS_URL   = "https://api.heygen.com/v1/video_status.get"
HEYGEN_AVATARS_URL  = "https://api.heygen.com/v2/avatars"
HEYGEN_VOICES_URL   = "https://api.heygen.com/v1/voice.list"
HEYGEN_PHOTO_UPLOAD = "https://upload.heygen.com/v1/talking_photo"

# Cache de IDs descobertos
_cached_avatar_id: Optional[str] = None
_cached_voice_id:  Optional[str] = None


def _headers() -> dict:
    return {
        "X-Api-Key": settings.HEYGEN_API_KEY,
        "Content-Type": "application/json",
    }


def _discover_avatar_id() -> str:
    """Retorna o primeiro avatar disponível na conta Heygen."""
    global _cached_avatar_id

    # Tenta usar o ID configurado primeiro
    configured = settings.HEYGEN_AVATAR_ID
    if configured and configured != "583ffb7fc260465797576f858ceb71d4":
        return configured

    if _cached_avatar_id:
        return _cached_avatar_id

    try:
        resp = requests.get(HEYGEN_AVATARS_URL, headers=_headers(), timeout=15)
        resp.raise_for_status()
        avatars = resp.json().get("data", {}).get("avatars", [])
        if avatars:
            _cached_avatar_id = avatars[0]["avatar_id"]
            return _cached_avatar_id
    except Exception as e:
        raise RuntimeError(
            f"Não foi possível listar avatares da sua conta Heygen: {e}\n"
            "Verifique se HEYGEN_AVATAR_ID no .env é um avatar válido da sua conta."
        )

    raise RuntimeError(
        "Nenhum avatar encontrado na sua conta Heygen. "
        "Crie um avatar em app.heygen.com e configure HEYGEN_AVATAR_ID no .env."
    )


def _discover_voice_id() -> str:
    """Retorna o primeiro voice_id disponível na conta Heygen."""
    global _cached_voice_id

    configured = settings.HEYGEN_VOICE_ID
    if configured and configured != "583ffb7fc260465797576f858ceb71d4":
        return configured

    if _cached_voice_id:
        return _cached_voice_id

    try:
        resp = requests.get(HEYGEN_VOICES_URL, headers=_headers(), timeout=15)
        resp.raise_for_status()
        voices = resp.json().get("data", {}).get("voices", [])
        # Preferência por vozes em português
        pt_voices = [v for v in voices if "pt" in v.get("language", "").lower()
                     or "portuguese" in v.get("language", "").lower()
                     or "brazil" in v.get("name", "").lower()
                     or "pt" in v.get("name", "").lower()]
        voice_list = pt_voices if pt_voices else voices
        if voice_list:
            _cached_voice_id = voice_list[0]["voice_id"]
            return _cached_voice_id
    except Exception as e:
        raise RuntimeError(f"Não foi possível listar vozes Heygen: {e}")

    raise RuntimeError("Nenhuma voz encontrada na sua conta Heygen.")


def _upload_talking_photo(photo_path: Path) -> str:
    """Faz upload da foto do usuário e retorna o talking_photo_id."""
    with open(photo_path, "rb") as f:
        resp = requests.post(
            HEYGEN_PHOTO_UPLOAD,
            headers={"X-Api-Key": settings.HEYGEN_API_KEY},
            files={"file": (photo_path.name, f, "image/jpeg")},
            timeout=60,
        )
    resp.raise_for_status()
    data = resp.json()
    talking_photo_id = (
        data.get("data", {}).get("talking_photo_id")
        or data.get("talking_photo_id")
    )
    if not talking_photo_id:
        raise RuntimeError(f"Upload da foto falhou: {data}")
    return talking_photo_id


def create_avatar_video(
    script_text: str,
    output_dir: Path,
    photo_path: Optional[Path] = None,
) -> Path:
    """Gera o vídeo de avatar com a voz nativa do Heygen a partir do texto do script."""
    video_id = _submit_job(script_text, photo_path)
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)


def _submit_job(script_text: str, photo_path: Optional[Path] = None) -> str:
    # Determina o character (talking photo ou avatar da conta)
    if photo_path and photo_path.exists():
        try:
            talking_photo_id = _upload_talking_photo(photo_path)
            character = {
                "type": "talking_photo",
                "talking_photo_id": talking_photo_id,
            }
        except Exception as e:
            # Se o upload falhar, cai no avatar padrão
            print(f"[Heygen] Talking photo falhou ({e}), usando avatar da conta.")
            character = {
                "type": "avatar",
                "avatar_id": _discover_avatar_id(),
                "avatar_style": "normal",
            }
    else:
        character = {
            "type": "avatar",
            "avatar_id": _discover_avatar_id(),
            "avatar_style": "normal",
        }

    voice_id = _discover_voice_id()

    payload = {
        "video_inputs": [
            {
                "character": character,
                "voice": {
                    "type": "text",
                    "input_text": script_text,
                    "voice_id": voice_id,
                    "speed": 1.0,
                },
                "background": {
                    "type": "color",
                    "value": "#1a1a2e",
                },
            }
        ],
        "dimension": {"width": 1080, "height": 1920},
    }

    resp = requests.post(
        HEYGEN_GENERATE_URL,
        json=payload,
        headers=_headers(),
        timeout=30,
    )

    if not resp.ok:
        try:
            err_body = resp.json()
        except Exception:
            err_body = resp.text
        raise RuntimeError(
            f"Heygen {resp.status_code}: {err_body}\n"
            "Verifique HEYGEN_AVATAR_ID e HEYGEN_VOICE_ID no .env."
        )

    data = resp.json()
    return data["data"]["video_id"]


def _poll_job(video_id: str) -> str:
    poll_headers = {"X-Api-Key": settings.HEYGEN_API_KEY}
    max_attempts = settings.HEYGEN_TIMEOUT_SEC // settings.HEYGEN_POLL_INTERVAL_SEC

    for _ in range(int(max_attempts)):
        resp = requests.get(
            HEYGEN_STATUS_URL,
            params={"video_id": video_id},
            headers=poll_headers,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()["data"]
        status = data["status"]

        if status == "completed":
            return data["video_url"]
        elif status == "failed":
            raise RuntimeError(f"Heygen falhou: {data.get('error', 'erro desconhecido')}")

        time.sleep(settings.HEYGEN_POLL_INTERVAL_SEC)

    raise TimeoutError(f"Heygen não concluiu em {settings.HEYGEN_TIMEOUT_SEC // 60} minutos.")


def _download_video(url: str, dest: Path) -> Path:
    resp = requests.get(url, stream=True, timeout=300)
    resp.raise_for_status()

    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    return dest
