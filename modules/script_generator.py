import json
import re

from config import settings
from models.project import Project
from models.script import Scene, Script, Timestamp
from utils.gemini_client import get_client, get_model


def generate_script(project: Project, feedback: str = "") -> Script:
    prompt = _build_prompt(project, feedback)
    response = get_client().models.generate_content(model=get_model(), contents=prompt)
    return _parse_response(response.text, project)


def _build_prompt(project: Project, feedback: str) -> str:
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

    raw_briefing_block = ""
    if project.raw_briefing:
        raw_briefing_block = f"""
BRIEFING DETALHADO DO USUÁRIO (use os dados, fontes e estatísticas reais abaixo para enriquecer o script — isso aumenta credibilidade e engajamento):
{project.raw_briefing}
"""

    return f"""Você é um filmmaker e roteirista especialista em conteúdo viral para redes sociais.
Sua missão é criar scripts que PARAM O SCROLL e geram alto engajamento.

TEMA: "{project.topic}"
FORMATO: {project.video_format.upper()} (9:16 — vertical)
DURAÇÃO: {duration_min:.1f} minuto(s) ({project.desired_duration_sec:.0f} segundos)
{brief_block}{raw_briefing_block}

TÉCNICAS OBRIGATÓRIAS DE ENGAJAMENTO:
1. Hook poderoso: os primeiros 3 segundos definem tudo — use pergunta, afirmação chocante ou dado surpreendente
2. Pattern interrupt: quebre o ritmo a cada 15-20s para manter atenção (dado novo, virada, pergunta retórica)
3. Storytelling: prefira "mostre, não diga" — use exemplos concretos, não abstrações
4. Urgência/relevância: por que o espectador precisa saber AGORA?
5. CTA natural: o encerramento deve fluir como consequência lógica, não forçada

REGRAS FIXAS:
- Cena índice 0 (Abertura): narração EXATAMENTE "{settings.OPENING_PHRASE}" | image_prompt vazio
- Última cena (Encerramento): narração EXATAMENTE "{settings.CLOSING_PHRASE}" | image_prompt vazio
- Soma de duration_sec = {project.desired_duration_sec:.0f} segundos EXATOS
- image_prompt de cenas de conteúdo: em inglês, cinematográfico, formato portrait 9:16, visualmente impactante
- Narração em português BR, linguagem natural e direta{feedback_block}

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


def _parse_response(raw: str, project: Project) -> Script:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    json_str = match.group(1).strip() if match else raw.strip()

    data = json.loads(json_str)
    scenes_data = data["scenes"]

    scenes = []
    timestamps = []
    cursor = 0.0

    for item in scenes_data:
        ts = Timestamp(
            scene_index=item["index"],
            label=item["label"],
            start_sec=cursor,
            end_sec=cursor + item["duration_sec"],
            element_type="image" if item.get("image_prompt") else "avatar",
        )
        scene = Scene(
            index=item["index"],
            label=item["label"],
            narration=item["narration"],
            image_prompt=item.get("image_prompt", ""),
            duration_sec=item["duration_sec"],
            timestamp=ts,
        )
        scenes.append(scene)
        timestamps.append(ts)
        cursor += item["duration_sec"]

    return Script(
        topic=project.topic,
        total_duration_sec=cursor,
        opening=settings.OPENING_PHRASE,
        closing=settings.CLOSING_PHRASE,
        scenes=scenes,
        timestamps=timestamps,
    )
