"""
Diretor criativo alimentado por Gemini.

Analisa o tema, propõe ângulos estratégicos, define o brief de conteúdo
e avalia o script gerado — tudo focado em engajamento e performance.
"""

import json
import re
from dataclasses import dataclass, field
from typing import List

from config import settings
from utils.gemini_client import get_client, get_model


@dataclass
class VideoAngle:
    title: str           # ex: "Revelação Surpreendente"
    hook: str            # frase de abertura que prende nos primeiros 3s
    structure: str       # como o conteúdo se desenvolve
    emotional_trigger: str  # curiosidade | medo | desejo | identificação | urgência
    why_it_works: str    # justificativa estratégica


@dataclass
class ContentBrief:
    topic: str
    chosen_angle: VideoAngle
    key_messages: List[str]       # 3-5 pontos principais do conteúdo
    visual_style: str             # orientação para as imagens
    visual_palette: str           # paleta de cores recomendada
    pacing_tip: str               # dica de ritmo/cortes para o formato
    engagement_tips: List[str]    # dicas extras de performance
    all_angles: List[VideoAngle] = field(default_factory=list)


@dataclass
class ScriptScore:
    overall: int                  # 0-10
    hook_strength: int            # 0-10 (primeiros 3s)
    retention_score: int          # 0-10 (mantém atenção até o fim?)
    cta_effectiveness: int        # 0-10 (encerramento converte?)
    strengths: List[str]
    improvements: List[str]       # sugestões específicas e acionáveis
    rewrite_suggestion: str       # se overall < 7, sugere reescrita do trecho mais fraco


def analyze_briefing(briefing_text: str, video_format: str, duration_sec: float) -> ContentBrief:
    """
    Analisa um briefing detalhado (com fontes, dados, temas) fornecido pelo usuário,
    extrai o tópico central e cria um ContentBrief enriquecido com os dados reais.
    """
    duration_min = duration_sec / 60
    prompt = f"""Você é um estrategista de conteúdo especialista em vídeos virais.

O usuário forneceu um BRIEFING DETALHADO com pesquisas, fontes e temas para criar um vídeo {video_format.upper()} de {duration_min:.1f} minuto(s).

BRIEFING DO USUÁRIO:
{briefing_text}

Sua tarefa:
1. Extraia o tema/título central deste briefing
2. Crie 3 ângulos estratégicos aproveitando os dados e fontes do briefing
3. Identifique as mensagens-chave mais impactantes presentes no conteúdo
4. Sugira o estilo visual mais adequado para o formato {video_format.upper()}

IMPORTANTE: Preserve e use os dados reais, estatísticas e fontes do briefing (Gartner, BCG, McKinsey, etc.) — eles são diferenciais de credibilidade.

Responda SOMENTE com JSON válido:
```json
{{
  "topic": "tema central extraído do briefing (curto, até 10 palavras)",
  "angles": [
    {{
      "title": "nome curto do ângulo",
      "hook": "frase exata para os primeiros 3 segundos — use um dado real do briefing",
      "structure": "como o conteúdo se desenvolve aproveitando o briefing (2 frases)",
      "emotional_trigger": "curiosidade|medo|desejo|identificação|urgência|surpresa",
      "why_it_works": "por que este ângulo gera engajamento aproveitando os dados do briefing"
    }}
  ],
  "recommended_index": 0,
  "key_messages": ["mensagem com dado real 1", "mensagem com dado real 2", "mensagem com dado real 3"],
  "visual_style": "descrição do estilo visual adequado",
  "visual_palette": "paleta de cores recomendada",
  "pacing_tip": "dica de ritmo para {video_format}",
  "engagement_tips": [
    "dica de engajamento aproveitando os dados do briefing 1",
    "dica de engajamento 2",
    "dica de engajamento 3"
  ]
}}
```"""

    response = get_client().models.generate_content(model=get_model(), contents=prompt)

    # Extrai o topic do JSON e monta o ContentBrief
    import json as _json
    import re as _re
    match = _re.search(r"```(?:json)?\s*([\s\S]*?)```", response.text)
    json_str = match.group(1).strip() if match else response.text.strip()
    data = _json.loads(json_str)

    extracted_topic = data.get("topic", "Conteúdo estratégico")

    angles = [
        VideoAngle(
            title=a["title"],
            hook=a["hook"],
            structure=a["structure"],
            emotional_trigger=a["emotional_trigger"],
            why_it_works=a["why_it_works"],
        )
        for a in data["angles"]
    ]

    chosen = angles[data.get("recommended_index", 0)]

    return ContentBrief(
        topic=extracted_topic,
        chosen_angle=chosen,
        key_messages=data.get("key_messages", []),
        visual_style=data.get("visual_style", ""),
        visual_palette=data.get("visual_palette", ""),
        pacing_tip=data.get("pacing_tip", ""),
        engagement_tips=data.get("engagement_tips", []),
        all_angles=angles,
    )


def analyze_topic(topic: str, video_format: str, duration_sec: float) -> ContentBrief:
    """Analisa o tema e retorna 3 ângulos estratégicos + brief completo."""
    model = None  # unused with new SDK
    prompt = _build_analysis_prompt(topic, video_format, duration_sec)
    response = get_client().models.generate_content(model=get_model(), contents=prompt)
    return _parse_brief(response.text, topic)


def score_script(raw_text: str, topic: str, video_format: str) -> ScriptScore:
    """Avalia o script gerado e retorna score + sugestões de melhoria."""
    model = None  # unused with new SDK
    prompt = _build_score_prompt(raw_text, topic, video_format)
    response = get_client().models.generate_content(model=get_model(), contents=prompt)
    return _parse_score(response.text)


def improve_image_prompt(basic_prompt: str, brief: ContentBrief, scene_label: str) -> str:
    """Aprimora um image_prompt simples com o contexto do brief visual."""
    model = None  # unused with new SDK
    prompt = f"""Você é um diretor de arte especialista em vídeos virais para redes sociais.

Aprimore este prompt de imagem para o gerador Imagen 3, tornando-o mais impactante e visualmente coerente com o estilo do vídeo.

Contexto do vídeo:
- Tema: {brief.topic}
- Estilo visual: {brief.visual_style}
- Paleta: {brief.visual_palette}
- Cena: {scene_label}

Prompt original: "{basic_prompt}"

Regras:
- Escreva em inglês
- Seja específico: composição, iluminação, estilo, emoção
- Mantenha formato vertical 9:16 (portrait)
- Foco em impacto visual imediato — a imagem deve parar o scroll
- Máximo 2 frases

Responda SOMENTE com o prompt aprimorado, sem explicações."""

    response = get_client().models.generate_content(model=get_model(), contents=prompt)
    improved = response.text.strip().strip('"').strip("'")
    return improved if improved else basic_prompt


def _build_analysis_prompt(topic: str, video_format: str, duration_sec: float) -> str:
    duration_min = duration_sec / 60
    return f"""Você é um estrategista de conteúdo especialista em vídeos virais para redes sociais (Instagram, TikTok, YouTube Shorts).

Analise o tema abaixo e crie 3 ângulos estratégicos diferentes para um vídeo de {duration_min:.1f} minuto(s) no formato {video_format.upper()} (9:16).

TEMA: "{topic}"

Para cada ângulo, pense como um produtor de conteúdo que conhece algoritmos, psicologia do consumidor e gatilhos de engajamento.

Responda SOMENTE com JSON válido:
```json
{{
  "angles": [
    {{
      "title": "nome curto do ângulo",
      "hook": "frase exata para os primeiros 3 segundos que prende a atenção",
      "structure": "como o conteúdo se desenvolve (2 frases)",
      "emotional_trigger": "curiosidade|medo|desejo|identificação|urgência|surpresa",
      "why_it_works": "por que este ângulo gera engajamento (1 frase)"
    }}
  ],
  "recommended_index": 0,
  "key_messages": ["mensagem 1", "mensagem 2", "mensagem 3"],
  "visual_style": "descrição do estilo visual (ex: minimalista corporativo, dinâmico com texto animado, etc.)",
  "visual_palette": "paleta de cores recomendada (ex: azul profundo + dourado, branco + vermelho vibrante)",
  "pacing_tip": "dica de ritmo para {video_format} (cortes, transições, tempo de cena)",
  "engagement_tips": [
    "dica de engajamento 1",
    "dica de engajamento 2",
    "dica de engajamento 3"
  ]
}}
```"""


def _build_score_prompt(raw_text: str, topic: str, video_format: str) -> str:
    return f"""Você é um especialista em performance de conteúdo para redes sociais.

Avalie o script abaixo para um vídeo de {video_format.upper()} sobre "{topic}".

SCRIPT:
{raw_text}

Critérios:
- hook_strength: os primeiros 3 segundos param o scroll?
- retention_score: o conteúdo mantém atenção até o fim?
- cta_effectiveness: o encerramento gera ação?
- overall: média ponderada (hook tem peso 40%)

Responda SOMENTE com JSON válido:
```json
{{
  "overall": <0-10>,
  "hook_strength": <0-10>,
  "retention_score": <0-10>,
  "cta_effectiveness": <0-10>,
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "improvements": [
    "melhoria específica e acionável 1",
    "melhoria específica e acionável 2"
  ],
  "rewrite_suggestion": "sugestão de reescrita do trecho mais fraco (vazio se overall >= 7)"
}}
```"""


def _parse_brief(raw: str, topic: str) -> ContentBrief:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    json_str = match.group(1).strip() if match else raw.strip()
    data = json.loads(json_str)

    angles = [
        VideoAngle(
            title=a["title"],
            hook=a["hook"],
            structure=a["structure"],
            emotional_trigger=a["emotional_trigger"],
            why_it_works=a["why_it_works"],
        )
        for a in data["angles"]
    ]

    chosen = angles[data.get("recommended_index", 0)]

    return ContentBrief(
        topic=topic,
        chosen_angle=chosen,
        key_messages=data.get("key_messages", []),
        visual_style=data.get("visual_style", ""),
        visual_palette=data.get("visual_palette", ""),
        pacing_tip=data.get("pacing_tip", ""),
        engagement_tips=data.get("engagement_tips", []),
        all_angles=angles,
    )


def _parse_score(raw: str) -> ScriptScore:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    json_str = match.group(1).strip() if match else raw.strip()
    data = json.loads(json_str)

    return ScriptScore(
        overall=data.get("overall", 0),
        hook_strength=data.get("hook_strength", 0),
        retention_score=data.get("retention_score", 0),
        cta_effectiveness=data.get("cta_effectiveness", 0),
        strengths=data.get("strengths", []),
        improvements=data.get("improvements", []),
        rewrite_suggestion=data.get("rewrite_suggestion", ""),
    )
