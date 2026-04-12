from pathlib import Path

import requests

from config import settings
from models.script import Script

ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"


def synthesize_voice(script: Script, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    audio_bytes = _call_elevenlabs(script.raw_text, settings.ELEVENLABS_VOICE_ID)
    output_path.write_bytes(audio_bytes)
    return output_path


def _call_elevenlabs(text: str, voice_id: str) -> bytes:
    url = ELEVENLABS_TTS_URL.format(voice_id=voice_id)
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": settings.ELEVENLABS_API_KEY,
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.0,
            "use_speaker_boost": True,
        },
    }

    response = requests.post(url, json=payload, headers=headers, stream=True, timeout=120)
    response.raise_for_status()

    chunks = []
    for chunk in response.iter_content(chunk_size=4096):
        if chunk:
            chunks.append(chunk)

    return b"".join(chunks)
