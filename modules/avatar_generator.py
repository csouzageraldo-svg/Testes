"""
Geração de vídeo com avatar via Heygen.
Usa a voz nativa do Heygen (voice_id configurado) — sem ElevenLabs.
"""

import time
from pathlib import Path
from typing import Optional

import requests

from config import settings

HEYGEN_GENERATE_URL = "https://api.heygen.com/v2/video/generate"
HEYGEN_STATUS_URL = "https://api.heygen.com/v1/video_status.get"


def create_avatar_video(script_text: str, output_dir: Path) -> Path:
    """Gera o vídeo de avatar com a voz nativa do Heygen a partir do texto do script."""
    video_id = _submit_job(script_text)
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)


def _submit_job(script_text: str) -> str:
    headers = {
        "X-Api-Key": settings.HEYGEN_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "video_inputs": [
            {
                "character": {
                    "type": "avatar",
                    "avatar_id": settings.HEYGEN_AVATAR_ID,
                    "avatar_style": "normal",
                },
                "voice": {
                    "type": "text",
                    "input_text": script_text,
                    "voice_id": settings.HEYGEN_VOICE_ID,
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

    response = requests.post(HEYGEN_GENERATE_URL, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data["data"]["video_id"]


def _poll_job(video_id: str) -> str:
    headers = {"X-Api-Key": settings.HEYGEN_API_KEY}
    max_attempts = settings.HEYGEN_TIMEOUT_SEC // settings.HEYGEN_POLL_INTERVAL_SEC

    for _ in range(int(max_attempts)):
        response = requests.get(
            HEYGEN_STATUS_URL,
            params={"video_id": video_id},
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()["data"]
        status = data["status"]

        if status == "completed":
            return data["video_url"]
        elif status == "failed":
            raise RuntimeError(f"Heygen falhou: {data.get('error', 'erro desconhecido')}")

        time.sleep(settings.HEYGEN_POLL_INTERVAL_SEC)

    raise TimeoutError(f"Heygen não concluiu em {settings.HEYGEN_TIMEOUT_SEC // 60} minutos.")


def _download_video(url: str, dest: Path) -> Path:
    response = requests.get(url, stream=True, timeout=300)
    response.raise_for_status()

    with open(dest, "wb") as f:
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)

    return dest
