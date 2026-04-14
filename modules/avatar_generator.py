"""
Geração de vídeo com avatar via Heygen API v3.

Endpoints v3 (mais simples e production-ready):
  POST /v3/videos       → { avatar_id, script, voice_id }  — usa script pronto
  POST /v3/video-agents → { avatar_id, prompt, voice_id }  — gera script automaticamente

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

HEYGEN_V3_VIDEOS_URL       = "https://api.heygen.com/v3/videos"
HEYGEN_V3_AGENTS_URL       = "https://api.heygen.com/v3/video-agents"
HEYGEN_STATUS_URL          = "https://api.heygen.com/v1/video_status.get"
HEYGEN_AVATARS_URL         = "https://api.heygen.com/v2/avatars"
HEYGEN_VOICES_URL          = "https://api.heygen.com/v2/voices"
HEYGEN_PHOTO_UPLOAD        = "https://upload.heygen.com/v1/talking_photo"

# IDs descobertos em runtime
_cached_avatar_id: Optional[str] = None
_cached_voice_id:  Optional[str] = None


def _headers() -> dict:
    return {
        "X-Api-Key": settings.HEYGEN_API_KEY,
        "Content-Type": "application/json",
    }


def _is_default_placeholder(val: str) -> bool:
    return not val or val == "583ffb7fc260465797576f858ceb71d4"


def _discover_avatar_id() -> str:
    """Retorna o primeiro avatar disponível na conta Heygen."""
    global _cached_avatar_id

    if not _is_default_placeholder(settings.HEYGEN_AVATAR_ID):
        return settings.HEYGEN_AVATAR_ID

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
            f"Não foi possível listar avatares Heygen: {e}\n"
            "Configure HEYGEN_AVATAR_ID no .env com um avatar válido da sua conta."
        )

    raise RuntimeError(
        "Nenhum avatar encontrado na sua conta Heygen. "
        "Crie um em app.heygen.com e configure HEYGEN_AVATAR_ID no .env."
    )


def _discover_voice_id() -> str:
    """Retorna o primeiro voice_id disponível (preferência por português)."""
    global _cached_voice_id

    if not _is_default_placeholder(settings.HEYGEN_VOICE_ID):
        return settings.HEYGEN_VOICE_ID

    if _cached_voice_id:
        return _cached_voice_id

    try:
        resp = requests.get(HEYGEN_VOICES_URL, headers=_headers(), timeout=15)
        resp.raise_for_status()
        voices = resp.json().get("data", {}).get("voices", [])
        pt_voices = [
            v for v in voices
            if "pt" in v.get("language", "").lower()
            or "portuguese" in v.get("language", "").lower()
            or "brazil" in v.get("name", "").lower()
        ]
        chosen = (pt_voices or voices)
        if chosen:
            _cached_voice_id = chosen[0]["voice_id"]
            return _cached_voice_id
    except Exception as e:
        raise RuntimeError(f"Não foi possível listar vozes Heygen: {e}")

    raise RuntimeError("Nenhuma voz encontrada na conta Heygen.")


def _upload_talking_photo(photo_path: Path) -> str:
    """Faz upload da foto e retorna talking_photo_id."""
    with open(photo_path, "rb") as f:
        resp = requests.post(
            HEYGEN_PHOTO_UPLOAD,
            headers={"X-Api-Key": settings.HEYGEN_API_KEY},
            files={"file": (photo_path.name, f, "image/jpeg")},
            timeout=60,
        )
    resp.raise_for_status()
    data = resp.json()
    photo_id = (
        data.get("data", {}).get("talking_photo_id")
        or data.get("talking_photo_id")
    )
    if not photo_id:
        raise RuntimeError(f"Upload da foto falhou: {data}")
    return photo_id


# ── API pública ────────────────────────────────────────────────────────────────

def create_avatar_video(
    script_text: str,
    output_dir: Path,
    photo_path: Optional[Path] = None,
) -> Path:
    """Gera vídeo de avatar via Heygen v3 e salva em output_dir."""
    video_id = _submit_v3(script_text, photo_path)
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)


def create_agent_video(
    prompt: str,
    output_dir: Path,
) -> Path:
    """
    Usa /v3/video-agents: o Heygen gera o script automaticamente a partir do prompt.
    Útil para vídeos rápidos onde não precisamos controlar o roteiro.
    """
    avatar_id = _discover_avatar_id()
    voice_id  = _discover_voice_id()

    payload = {
        "avatar_id": avatar_id,
        "voice_id":  voice_id,
        "prompt":    prompt,
    }

    resp = requests.post(HEYGEN_V3_AGENTS_URL, json=payload, headers=_headers(), timeout=30)
    _raise_for_heygen(resp)

    video_id = resp.json()["data"]["video_id"]
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)


# ── Internos ───────────────────────────────────────────────────────────────────

def _submit_v3(script_text: str, photo_path: Optional[Path] = None) -> str:
    """Submete job via POST /v3/videos com payload aninhado (mesmo esquema do v2)."""
    voice_id = _discover_voice_id()

    # Monta o character (avatar padrão ou talking photo)
    if photo_path and photo_path.exists():
        try:
            talking_photo_id = _upload_talking_photo(photo_path)
            character = {
                "type": "talking_photo",
                "talking_photo_id": talking_photo_id,
            }
        except Exception as e:
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

    payload = {
        "video_inputs": [
            {
                "character": character,
                "voice": {
                    "type": "text",
                    "input_text": script_text,
                    "voice_id": voice_id,
                },
                "background": {
                    "type": "color",
                    "value": "#1a1a2e",
                },
            }
        ],
        "dimension": {"width": 1080, "height": 1920},
    }

    resp = requests.post(HEYGEN_V3_VIDEOS_URL, json=payload, headers=_headers(), timeout=30)
    _raise_for_heygen(resp)

    return resp.json()["data"]["video_id"]


def _raise_for_heygen(resp: requests.Response) -> None:
    if not resp.ok:
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        raise RuntimeError(
            f"Heygen {resp.status_code}: {body}\n"
            "Verifique HEYGEN_AVATAR_ID e HEYGEN_VOICE_ID no .env."
        )


def _poll_job(video_id: str) -> str:
    poll_headers = {"X-Api-Key": settings.HEYGEN_API_KEY}
    max_attempts = int(settings.HEYGEN_TIMEOUT_SEC // settings.HEYGEN_POLL_INTERVAL_SEC)

    for _ in range(max_attempts):
        resp = requests.get(
            HEYGEN_STATUS_URL,
            params={"video_id": video_id},
            headers=poll_headers,
            timeout=30,
        )
        resp.raise_for_status()
        data   = resp.json()["data"]
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
