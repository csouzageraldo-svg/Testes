import json
import re

from config import settings
from models.project import Project
from models.script import Scene, Script, Timestamp
from utils.gemini_client import get_client, get_model


def generate_script(project: Project, feedback: str = "") -> Script:
    # Tenta com prompt completo, depois simplificado se falhar
    for attempt, use_simple in enumerate([False, True]):
        try:
            prompt = _build_prompt(project, feedback, simple=use_simple)
            response = get_client().models.generate_content(
                model=get_model(), contents=prompt
            )
            return _parse_response(response.text, project)
        except Exception as e:
            if attempt == 0:
                continue  # tenta com prompt simples
            raise e


def _build_prompt(project: Project, feedback: str, simple: bool = False) -> str:
    duration_min = project.desired_duration_sec / 60
    feedback_block = f"\n\nAJUSTE SOLICITADO: {feedback}" if feedback else ""

    brief = project.content_brief
    brief_block = ""
    if brief:
        brief_block = f"""
BRIEF ESTRATÉGICO (use como base):
- Ângulo escolhido: {brief.chosen_angle.title}
- Hook de abertura: {brief.chosen_angle.hook}
- Gatilho emocional: {brief.chosen_angle.emotional_trigger}
- Estrutura: {brief.chosen_angle.structure}
- Mensagens-chave: {", ".join(brief.key_messages)}
- Estilo visual das imagens: {brief.visual_style}
- Dica de ritmo: {brief.pacing_tip}
"""

    # Briefing resumido (apenas no prompt completo)
    briefing_block = ""
    if not simple and project.raw_briefing:
        briefing_block = f"\nDATOS DO BRIEFING: {project.raw_briefing[:800]}\n"

    if simple:
        # Prompt mínimo para garantir resposta rápida
        return f"""Crie um script de vídeo curto para redes sociais.
TEMA: {project.topic}
DURAÇÃO TOTAL: {project.desired_duration_sec:.0f} segundos
HOOK: {brief.chosen_angle.hook if brief else 'abertura impactante'}
{feedback_block}
Cena 0 = abertura com narração EXATAMENTE: "{settings.OPENING_PHRASE}"
Última cena = encerramento EXATAMENTE: "{settings.CLOSING_PHRASE}"
Demais cenas em português BR, diretas e engajantes."""

    return f"""Roteirista especialista em vídeos virais. Crie script de {duration_min:.0f} min para {project.video_format.upper()}.
TEMA: "{project.topic}"
{brief_block}{briefing_block}
REGRAS: cena 0 narração="{settings.OPENING_PHRASE}" sem image_prompt. Última cena narração="{settings.CLOSING_PHRASE}" sem image_prompt. Total={project.desired_duration_sec:.0f}s. Narração em PT-BR. image_prompt em inglês, portrait 9:16.{feedback_block}

Responda SOMENTE com JSON válido (sem texto fora do bloco):
```json
{{
  "scenes": [
    {{
      "index": 0,
      "label": "Abertura",
      "narration": "{settings.OPENING_PHRASE}",
      "image_prompt": "",
      "duration_sec": 5.0
    }},
    {{
      "index": 1,
      "label": "Hook — <título impactante>",
      "narration": "<narração que prende em 3 segundos>",
      "image_prompt": "<prompt cinematográfico em inglês para Imagen 3, portrait 9:16>",
      "duration_sec": <número>
    }}
  ]
}}
```"""


def _safe_json_loads(raw: str) -> dict:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    json_str = match.group(1).strip() if match else raw.strip()
    if not match:
        obj_match = re.search(r"(\{[\s\S]*\})", raw)
        if obj_match:
            json_str = obj_match.group(1)
    json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
    json_str = re.sub(r"//[^\n]*", "", json_str)
    json_str = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", json_str)
    return json.loads(json_str)


def _parse_response(raw: str, project: Project) -> Script:
    data = _safe_json_loads(raw)
    # Aceita "scenes" ou "cenas" como chave raiz
    scenes_data = data.get("scenes") or data.get("cenas") or []

    scenes = []
    timestamps = []
    cursor = 0.0

    for i, item in enumerate(scenes_data):
        # Aceita variações de nomes de campos que o modelo pode usar
        narration = (
            item.get("narration")
            or item.get("narracao")
            or item.get("narração")
            or item.get("text")
            or item.get("texto")
            or item.get("content")
            or item.get("speech")
            or item.get("fala")
            or ""
        )
        label = item.get("label") or item.get("titulo") or item.get("title") or f"Cena {i}"
        duration = float(item.get("duration_sec") or item.get("duracao") or item.get("duration") or 5)
        image_prompt = item.get("image_prompt") or item.get("prompt") or item.get("visual") or ""
        index = item.get("index", i)

        scenes.append((index, label, narration, image_prompt, duration))

    # Normaliza durações se o total estiver muito fora do pedido
    total_raw = sum(s[4] for s in scenes) or 1
    target = project.desired_duration_sec
    scale = target / total_raw if total_raw > target * 1.5 else 1.0

    cursor = 0.0
    result_scenes, result_timestamps = [], []
    for (index, label, narration, image_prompt, raw_dur) in scenes:
        duration = round(raw_dur * scale, 1)
        duration = max(3.0, duration)

        ts = Timestamp(
            scene_index=index,
            label=label,
            start_sec=cursor,
            end_sec=cursor + duration,
            element_type="image" if image_prompt else "avatar",
        )
        scene = Scene(
            index=index,
            label=label,
            narration=narration,
            image_prompt=image_prompt,
            duration_sec=duration,
            timestamp=ts,
        )
        result_scenes.append(scene)
        result_timestamps.append(ts)
        cursor += duration

    return Script(
        topic=project.topic,
        total_duration_sec=cursor,
        opening=settings.OPENING_PHRASE,
        closing=settings.CLOSING_PHRASE,
        scenes=result_scenes,
        timestamps=result_timestamps,
    )
