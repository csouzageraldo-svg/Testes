"""
fix_files.py — Corrige os arquivos do projeto com as versões mais recentes.
Execute: python fix_files.py
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"✅ {path}")

# ── modules/avatar_generator.py ───────────────────────────────────────────────
write("modules/avatar_generator.py", '''"""
Geração de vídeo com avatar via Heygen API v3.
"""
import time
from pathlib import Path
from typing import Optional
import requests
from config import settings

HEYGEN_V3_VIDEOS_URL = "https://api.heygen.com/v3/videos"
HEYGEN_V3_AGENTS_URL = "https://api.heygen.com/v3/video-agents"
HEYGEN_STATUS_URL    = "https://api.heygen.com/v1/video_status.get"
HEYGEN_AVATARS_URL   = "https://api.heygen.com/v2/avatars"
HEYGEN_VOICES_URL    = "https://api.heygen.com/v2/voices"
HEYGEN_PHOTO_UPLOAD  = "https://upload.heygen.com/v1/talking_photo"

_cached_avatar_id: Optional[str] = None
_cached_voice_id:  Optional[str] = None


def _headers():
    return {"X-Api-Key": settings.HEYGEN_API_KEY, "Content-Type": "application/json"}

def _is_placeholder(val):
    return not val or val == "583ffb7fc260465797576f858ceb71d4"

def _discover_avatar_id():
    global _cached_avatar_id
    if not _is_placeholder(settings.HEYGEN_AVATAR_ID):
        return settings.HEYGEN_AVATAR_ID
    if _cached_avatar_id:
        return _cached_avatar_id
    resp = requests.get(HEYGEN_AVATARS_URL, headers=_headers(), timeout=15)
    resp.raise_for_status()
    avatars = resp.json().get("data", {}).get("avatars", [])
    if not avatars:
        raise RuntimeError("Nenhum avatar encontrado na conta Heygen.")
    _cached_avatar_id = avatars[0]["avatar_id"]
    return _cached_avatar_id

def _discover_voice_id():
    global _cached_voice_id
    if not _is_placeholder(settings.HEYGEN_VOICE_ID):
        return settings.HEYGEN_VOICE_ID
    if _cached_voice_id:
        return _cached_voice_id
    resp = requests.get(HEYGEN_VOICES_URL, headers=_headers(), timeout=15)
    resp.raise_for_status()
    voices = resp.json().get("data", {}).get("voices", [])
    pt = [v for v in voices if "pt" in v.get("language","").lower()
          or "portuguese" in v.get("language","").lower()]
    chosen = pt or voices
    if not chosen:
        raise RuntimeError("Nenhuma voz encontrada na conta Heygen.")
    _cached_voice_id = chosen[0]["voice_id"]
    return _cached_voice_id

def _upload_talking_photo(photo_path: Path) -> str:
    with open(photo_path, "rb") as f:
        resp = requests.post(
            HEYGEN_PHOTO_UPLOAD,
            headers={"X-Api-Key": settings.HEYGEN_API_KEY},
            files={"file": (photo_path.name, f, "image/jpeg")},
            timeout=60,
        )
    resp.raise_for_status()
    data = resp.json()
    photo_id = data.get("data", {}).get("talking_photo_id") or data.get("talking_photo_id")
    if not photo_id:
        raise RuntimeError(f"Upload da foto falhou: {data}")
    return photo_id

def create_avatar_video(script_text: str, output_dir: Path, photo_path: Optional[Path] = None) -> Path:
    video_id = _submit_v3(script_text, photo_path)
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)

def create_agent_video(prompt: str, output_dir: Path) -> Path:
    payload = {"avatar_id": _discover_avatar_id(), "voice_id": _discover_voice_id(), "prompt": prompt}
    resp = requests.post(HEYGEN_V3_AGENTS_URL, json=payload, headers=_headers(), timeout=30)
    _raise_for_heygen(resp)
    video_id = resp.json()["data"]["video_id"]
    download_url = _poll_job(video_id)
    output_path = output_dir / "avatar_video.mp4"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return _download_video(download_url, output_path)

def _submit_v3(script_text: str, photo_path: Optional[Path] = None) -> str:
    voice_id = _discover_voice_id()
    if photo_path and photo_path.exists():
        try:
            talking_photo_id = _upload_talking_photo(photo_path)
            character = {"type": "talking_photo", "talking_photo_id": talking_photo_id}
        except Exception as e:
            print(f"[Heygen] Talking photo falhou ({e}), usando avatar da conta.")
            character = {"type": "avatar", "avatar_id": _discover_avatar_id(), "avatar_style": "normal"}
    else:
        character = {"type": "avatar", "avatar_id": _discover_avatar_id(), "avatar_style": "normal"}

    payload = {
        "video_inputs": [{
            "character": character,
            "voice": {"type": "text", "input_text": script_text, "voice_id": voice_id},
            "background": {"type": "color", "value": "#1a1a2e"},
        }],
        "dimension": {"width": 1080, "height": 1920},
    }
    resp = requests.post(HEYGEN_V3_VIDEOS_URL, json=payload, headers=_headers(), timeout=30)
    _raise_for_heygen(resp)
    return resp.json()["data"]["video_id"]

def _raise_for_heygen(resp):
    if not resp.ok:
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        raise RuntimeError(f"Heygen {resp.status_code}: {body}")

def _poll_job(video_id: str) -> str:
    h = {"X-Api-Key": settings.HEYGEN_API_KEY}
    attempts = int(settings.HEYGEN_TIMEOUT_SEC // settings.HEYGEN_POLL_INTERVAL_SEC)
    for _ in range(attempts):
        resp = requests.get(HEYGEN_STATUS_URL, params={"video_id": video_id}, headers=h, timeout=30)
        resp.raise_for_status()
        data = resp.json()["data"]
        if data["status"] == "completed":
            return data["video_url"]
        elif data["status"] == "failed":
            raise RuntimeError(f"Heygen falhou: {data.get('error','erro desconhecido')}")
        time.sleep(settings.HEYGEN_POLL_INTERVAL_SEC)
    raise TimeoutError(f"Heygen nao concluiu em {settings.HEYGEN_TIMEOUT_SEC//60} minutos.")

def _download_video(url: str, dest: Path) -> Path:
    resp = requests.get(url, stream=True, timeout=300)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
    return dest
''')

# ── modules/script_generator.py ───────────────────────────────────────────────
write("modules/script_generator.py", '''import json
import re
from config import settings
from models.project import Project
from models.script import Scene, Script, Timestamp
from utils.gemini_client import get_client, get_model


def generate_script(project: Project, feedback: str = "") -> Script:
    for attempt, use_simple in enumerate([False, True]):
        try:
            prompt = _build_prompt(project, feedback, simple=use_simple)
            response = get_client().models.generate_content(model=get_model(), contents=prompt)
            return _parse_response(response.text, project)
        except Exception as e:
            if attempt == 0:
                continue
            raise e


def _build_prompt(project, feedback, simple=False):
    duration_min = project.desired_duration_sec / 60
    feedback_block = f"\\n\\nAJUSTE SOLICITADO: {feedback}" if feedback else ""
    brief = project.content_brief
    brief_block = ""
    if brief:
        brief_block = f"""
BRIEF ESTRATEGICO (use como base):
- Angulo: {brief.chosen_angle.title}
- Hook: {brief.chosen_angle.hook}
- Gatilho emocional: {brief.chosen_angle.emotional_trigger}
- Estrutura: {brief.chosen_angle.structure}
- Mensagens-chave: {", ".join(brief.key_messages)}
- Estilo visual: {brief.visual_style}
- Ritmo: {brief.pacing_tip}
"""
    briefing_block = ""
    if not simple and project.raw_briefing:
        briefing_block = f"\\nDATOS DO BRIEFING: {project.raw_briefing[:800]}\\n"

    if simple:
        return f"""Crie um script de video curto para redes sociais.
TEMA: {project.topic}
DURACAO TOTAL: {project.desired_duration_sec:.0f} segundos
HOOK: {brief.chosen_angle.hook if brief else "abertura impactante"}
{feedback_block}
Cena 0 = abertura com narracao EXATAMENTE: "{settings.OPENING_PHRASE}"
Ultima cena = encerramento EXATAMENTE: "{settings.CLOSING_PHRASE}"
Demais cenas em portugues BR, diretas e engajantes."""

    return f"""Roteirista especialista em videos virais. Crie script de {duration_min:.0f} min para {project.video_format.upper()}.
TEMA: "{project.topic}"
{brief_block}{briefing_block}
REGRAS: cena 0 narracao="{settings.OPENING_PHRASE}" sem image_prompt. Ultima cena narracao="{settings.CLOSING_PHRASE}" sem image_prompt. Total={project.desired_duration_sec:.0f}s. Narracao em PT-BR. image_prompt em ingles, portrait 9:16.{feedback_block}

Responda SOMENTE com JSON valido (sem texto fora do bloco):
```json
{{
  "scenes": [
    {{"index": 0, "label": "Abertura", "narration": "{settings.OPENING_PHRASE}", "image_prompt": "", "duration_sec": 5.0}},
    {{"index": 1, "label": "Hook", "narration": "<narracao>", "image_prompt": "<prompt em ingles>", "duration_sec": 8.0}}
  ]
}}
```"""


def _safe_json_loads(raw):
    match = re.search(r"```(?:json)?\\s*([\\s\\S]*?)```", raw)
    json_str = match.group(1).strip() if match else raw.strip()
    if not match:
        obj_match = re.search(r"(\\{[\\s\\S]*\\})", raw)
        if obj_match:
            json_str = obj_match.group(1)
    json_str = re.sub(r",\\s*([}\\]])", r"\\1", json_str)
    json_str = re.sub(r"//[^\\n]*", "", json_str)
    json_str = re.sub(r"[\\x00-\\x08\\x0b\\x0c\\x0e-\\x1f]", "", json_str)
    return json.loads(json_str)


def _parse_response(raw, project):
    data = _safe_json_loads(raw)
    scenes_data = data.get("scenes") or data.get("cenas") or []
    scenes = []
    for i, item in enumerate(scenes_data):
        narration = (item.get("narration") or item.get("narracao") or item.get("narracao")
                     or item.get("text") or item.get("texto") or item.get("speech") or "")
        label = item.get("label") or item.get("titulo") or item.get("title") or f"Cena {i}"
        duration = float(item.get("duration_sec") or item.get("duracao") or item.get("duration") or 5)
        image_prompt = item.get("image_prompt") or item.get("prompt") or item.get("visual") or ""
        index = item.get("index", i)
        scenes.append((index, label, narration, image_prompt, duration))

    total_raw = sum(s[4] for s in scenes) or 1
    target = project.desired_duration_sec
    scale = target / total_raw if total_raw > target * 1.5 else 1.0

    cursor = 0.0
    result_scenes, result_timestamps = [], []
    for (index, label, narration, image_prompt, raw_dur) in scenes:
        duration = max(3.0, round(raw_dur * scale, 1))
        ts = Timestamp(scene_index=index, label=label, start_sec=cursor,
                       end_sec=cursor + duration, element_type="image" if image_prompt else "avatar")
        scene = Scene(index=index, label=label, narration=narration,
                      image_prompt=image_prompt, duration_sec=duration, timestamp=ts)
        result_scenes.append(scene)
        result_timestamps.append(ts)
        cursor += duration

    return Script(topic=project.topic, total_duration_sec=cursor,
                  opening=settings.OPENING_PHRASE, closing=settings.CLOSING_PHRASE,
                  scenes=result_scenes, timestamps=result_timestamps)
''')

print("\n✅ Todos os arquivos corrigidos! Reinicie o bot: iniciar.bat")
