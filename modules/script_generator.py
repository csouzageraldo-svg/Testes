import json
import re

import google.generativeai as genai

from config import settings
from models.project import Project
from models.script import Scene, Script, Timestamp

genai.configure(api_key=settings.GEMINI_API_KEY)


def generate_script(project: Project, feedback: str = "") -> Script:
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    prompt = _build_prompt(project, feedback)
    response = model.generate_content(prompt)
    return _parse_response(response.text, project)


def _build_prompt(project: Project, feedback: str) -> str:
    duration_min = project.desired_duration_sec / 60
    feedback_block = f"\n\nAjuste baseado no feedback: {feedback}" if feedback else ""

    return f"""Você é um filmmaker especialista em conteúdo de redes sociais e engajamento.
Crie um script para um vídeo de avatar no formato {project.video_format.upper()} (9:16) sobre o tema:
"{project.topic}"

Duração total: {duration_min:.1f} minuto(s) ({project.desired_duration_sec:.0f} segundos)

REGRAS OBRIGATÓRIAS:
1. A cena de índice 0 (abertura) DEVE usar exatamente esta narração:
   "{settings.OPENING_PHRASE}"
2. A última cena (encerramento) DEVE usar exatamente esta narração:
   "{settings.CLOSING_PHRASE}"
3. Todas as cenas intermediárias devem tratar do tema com informações relevantes e engajantes.
4. A soma de duration_sec de todas as cenas DEVE ser exatamente {project.desired_duration_sec:.0f} segundos.
5. Cada cena intermediária deve ter um image_prompt descritivo em inglês para gerar uma imagem de impacto.
6. Cenas de abertura e encerramento têm image_prompt vazio ("").{feedback_block}

Responda SOMENTE com um bloco JSON válido neste formato (sem texto adicional fora do JSON):
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
      "label": "Cena 1 - <título>",
      "narration": "<texto narrado pelo avatar>",
      "image_prompt": "<descrição em inglês da imagem de impacto para esta cena>",
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
