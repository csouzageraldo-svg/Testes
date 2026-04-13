"""
Handlers do bot Telegram — fluxo conversacional completo.
Reutiliza todos os módulos existentes (content_advisor, script_generator, etc.)
"""

import asyncio
import tempfile
from pathlib import Path
from typing import Optional

from telegram import Update, Message
from telegram.ext import ContextTypes, ConversationHandler

from config import settings
from models.project import Project
from modules import (
    avatar_generator,
    content_advisor,
    image_generator,
    scene_video_generator,
    script_generator,
    video_assembler,
)
from utils import file_manager
from bot.states import (
    ANGLE,
    BRIEFING,
    CONCEPT_REVIEW,
    DURATION,
    FORMAT,
    MODE,
    PHOTO,
    SCRIPT_FEEDBACK,
    SCRIPT_REVIEW,
    TOPIC,
)
from bot.keyboards import (
    angles_keyboard,
    approval_keyboard,
    concept_keyboard,
    format_keyboard,
    images_approval_keyboard,
    photo_keyboard,
    start_mode_keyboard,
)

FMT_NAMES = {"stories": "Stories", "reels": "Reels", "tiktok": "TikTok"}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _score_bar(v: int) -> str:
    return "█" * v + "░" * (10 - v) + f" {v}/10"


def _format_script(project: Project) -> str:
    text = "📝 *Script Gerado*\n\n"
    for scene in project.script.scenes:
        narration = scene.narration
        if len(narration) > 120:
            narration = narration[:120] + "…"
        text += f"*[{scene.label}]* `{scene.duration_sec:.0f}s`\n{narration}\n\n"

    score = project.script_score
    if score:
        text += (
            f"📊 *Engajamento*\n"
            f"Geral: `{_score_bar(score.overall)}`\n"
            f"Hook:  `{_score_bar(score.hook_strength)}`\n"
            f"Ret.:  `{_score_bar(score.retention_score)}`\n"
            f"CTA:   `{_score_bar(score.cta_effectiveness)}`\n"
        )
        if score.improvements:
            text += "\n💡 *Melhorias sugeridas:*\n"
            text += "\n".join(f"• {i}" for i in score.improvements[:3])
        if score.overall < 7 and score.rewrite_suggestion:
            text += f"\n\n⚠️ *Trecho fraco:* _{score.rewrite_suggestion}_"

    if len(text) > 4000:
        text = text[:3950] + "\n…_(truncado)_"

    return text


async def _generate_and_score_script(
    project: Project, msg: Message, feedback: str = ""
) -> None:
    await msg.edit_text("✍️ Gerando script focado em engajamento…")
    project.script = await asyncio.wait_for(
        asyncio.to_thread(script_generator.generate_script, project, feedback),
        timeout=90.0,
    )
    project.script_score = None  # Score avaliado em background


async def _evaluate_score_background(
    project: Project, chat_id: int, bot
) -> None:
    """Avalia o score em background e envia como mensagem separada."""
    try:
        score = await asyncio.wait_for(
            asyncio.to_thread(
                content_advisor.score_script,
                project.script.raw_text,
                project.topic,
                project.video_format,
            ),
            timeout=60.0,
        )
        project.script_score = score
        score_text = (
            f"📊 *Score de Engajamento*\n"
            f"Geral: `{'█' * score.overall}{'░' * (10 - score.overall)} {score.overall}/10`\n"
            f"Hook:  `{'█' * score.hook_strength}{'░' * (10 - score.hook_strength)} {score.hook_strength}/10`\n"
            f"Ret.:  `{'█' * score.retention_score}{'░' * (10 - score.retention_score)} {score.retention_score}/10`\n"
            f"CTA:   `{'█' * score.cta_effectiveness}{'░' * (10 - score.cta_effectiveness)} {score.cta_effectiveness}/10`"
        )
        if score.improvements:
            score_text += "\n\n💡 *Melhorias:*\n" + "\n".join(f"• {i}" for i in score.improvements[:3])
        await bot.send_message(chat_id=chat_id, text=score_text, parse_mode="Markdown")
    except Exception:
        pass  # Score é opcional, não bloqueia o fluxo


async def _show_next_concept(message: Message, context: ContextTypes.DEFAULT_TYPE) -> int:
    concepts: list = context.user_data["pending_concepts"]
    idx: int = context.user_data["concept_index"]

    if idx >= len(concepts):
        approved: list = context.user_data["approved_concepts"]
        project: Project = context.user_data["project"]

        if not approved:
            await message.reply_text("⚠️ Nenhum conceito aprovado. Continuando sem imagens.")
            project.image_concepts = []
            return await _run_voice_and_video(message, context)

        project.image_concepts = approved
        msg = await message.reply_text(
            f"✅ {len(approved)} conceito(s) aprovado(s)!\n\n"
            f"🎬 Gerando vídeos de cena com Gemini Veo 2…\n_(pode levar alguns minutos)_",
            parse_mode="Markdown",
        )
        return await _generate_scene_videos(msg, context)

    concept = concepts[idx]
    total = len(concepts)
    await message.reply_text(
        f"🎨 *Conceito de Imagem {idx + 1}/{total}*\n\n_{concept}_",
        parse_mode="Markdown",
        reply_markup=concept_keyboard(idx),
    )
    return CONCEPT_REVIEW


async def _generate_scene_videos(msg: Message, context: ContextTypes.DEFAULT_TYPE) -> int:
    project: Project = context.user_data["project"]
    approved = project.image_concepts

    try:
        project.animated_clip_paths = await asyncio.to_thread(
            scene_video_generator.generate_scene_videos,
            approved,
            project.script.timestamps,
            project.dirs["animated"],
        )
        await msg.edit_text(
            f"✅ {len(project.animated_clip_paths)} vídeo(s) de cena gerado(s) com Veo 2!"
        )
    except Exception as e:
        await msg.edit_text(f"⚠️ Veo 2 falhou: {e}\n\nContinuando sem overlay.")
        project.animated_clip_paths = []

    return await _run_voice_and_video(msg, context)


async def _run_voice_and_video(msg: Message, context: ContextTypes.DEFAULT_TYPE) -> int:
    project: Project = context.user_data["project"]

    # Foto do avatar (voz é gerada pelo Heygen)
    await msg.edit_text(
        "📸 *Foto para o avatar*\n\nEnvie sua foto (jpg/png) ou pule para usar o avatar padrão.",
        parse_mode="Markdown",
        reply_markup=photo_keyboard(),
    )
    return PHOTO


# ── Handlers de conversa ───────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data.clear()
    await update.message.reply_text(
        "🎬 *Gerador de Vídeos Com Avatar*\n\n"
        "Olá! Sou o assistente criativo do Carlos.\n"
        "Vou criar um vídeo de alto engajamento para suas redes sociais.\n\n"
        "Como você quer começar?",
        parse_mode="Markdown",
        reply_markup=start_mode_keyboard(),
    )
    return MODE


async def receive_mode(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    mode = query.data.split(":")[1]

    if mode == "briefing":
        await query.edit_message_text(
            "📋 *Modo Briefing*\n\n"
            "Cole aqui seu material: temas, fontes, dados, resumos, roteiros rascunho...\n\n"
            "Vou analisar tudo, extrair o melhor e criar um vídeo de alta performance com esse conteúdo.",
            parse_mode="Markdown",
        )
        return BRIEFING
    else:
        await query.edit_message_text(
            "📝 Qual é o *tema* do vídeo?\n\n"
            "_Ex: IA e liderança de agentes nas empresas_",
            parse_mode="Markdown",
        )
        return TOPIC


async def receive_briefing(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    briefing_text = update.message.text.strip()
    context.user_data["raw_briefing"] = briefing_text

    msg = await update.message.reply_text("🔍 Analisando seu briefing e extraindo o melhor conteúdo…")

    try:
        # Usa analyze_briefing para extrair topic + ContentBrief do texto detalhado
        brief = await asyncio.to_thread(
            content_advisor.analyze_briefing,
            briefing_text,
            "reels",  # formato temporário — será atualizado após o usuário escolher
            90,       # duração temporária
        )
        context.user_data["brief_from_briefing"] = brief
        context.user_data["topic"] = brief.topic
    except Exception as e:
        await msg.edit_text(f"❌ Erro ao analisar briefing: {e}\n\nUse /start para recomeçar.")
        return ConversationHandler.END

    await msg.edit_text(
        f"✅ Briefing analisado!\n\n"
        f"📌 Tema extraído: *{brief.topic}*\n\n"
        f"Escolha o formato do vídeo:",
        parse_mode="Markdown",
        reply_markup=format_keyboard(),
    )
    return FORMAT


async def receive_topic(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    topic = update.message.text.strip()
    context.user_data["topic"] = topic

    await update.message.reply_text(
        f"📌 Tema: *{topic}*\n\nEscolha o formato:",
        parse_mode="Markdown",
        reply_markup=format_keyboard(),
    )
    return FORMAT


async def receive_format(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    fmt = query.data.split(":")[1]
    context.user_data["format"] = fmt

    await query.edit_message_text(
        f"📌 Tema: *{context.user_data['topic']}*\n"
        f"📐 Formato: *{FMT_NAMES[fmt]}*\n\n"
        f"⏱ Qual a *duração* desejada?\n"
        f"_Ex: 0.5 (30s) · 1 (1min) · 1.5 (1min30s)_\n\n"
        f"💡 30–60s tem maior retenção no {FMT_NAMES[fmt]}.",
        parse_mode="Markdown",
    )
    return DURATION


async def receive_duration(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        minutes = float(update.message.text.strip().replace(",", "."))
        if minutes <= 0:
            raise ValueError()
    except ValueError:
        await update.message.reply_text("⚠️ Valor inválido. Digite um número como 0.5, 1 ou 1.5.")
        return DURATION

    context.user_data["duration_sec"] = minutes * 60

    # Se veio de briefing, re-analisa com formato e duração corretos
    if "brief_from_briefing" in context.user_data:
        msg = await update.message.reply_text("🔍 Refinando análise do briefing com formato e duração…")
        try:
            brief = await asyncio.to_thread(
                content_advisor.analyze_briefing,
                context.user_data["raw_briefing"],
                context.user_data["format"],
                context.user_data["duration_sec"],
            )
            context.user_data["brief"] = brief
            context.user_data["topic"] = brief.topic
            del context.user_data["brief_from_briefing"]
        except Exception as e:
            await msg.edit_text(f"❌ Erro na análise: {e}\n\nUse /start para recomeçar.")
            return ConversationHandler.END
    else:
        msg = await update.message.reply_text("🔍 Analisando tema e criando brief estratégico…")
        try:
            brief = await asyncio.to_thread(
                content_advisor.analyze_topic,
                context.user_data["topic"],
                context.user_data["format"],
                context.user_data["duration_sec"],
            )
            context.user_data["brief"] = brief
        except Exception as e:
            await msg.edit_text(f"❌ Erro na análise: {e}\n\nUse /start para recomeçar.")
            return ConversationHandler.END

    text = "🎯 *Análise Estratégica — Escolha o Ângulo*\n\n"
    for i, angle in enumerate(brief.all_angles):
        prefix = "⭐ " if i == 0 else f"{i + 1}. "
        text += (
            f"{prefix}*{angle.title}*\n"
            f"   Hook: _{angle.hook}_\n"
            f"   Gatilho: `{angle.emotional_trigger}` · {angle.why_it_works}\n\n"
        )
    text += "_⭐ = Recomendado pelo agente_"

    await msg.edit_text(text, parse_mode="Markdown", reply_markup=angles_keyboard(brief.all_angles))
    return ANGLE


async def receive_angle(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    idx = int(query.data.split(":")[1])
    brief = context.user_data["brief"]
    brief.chosen_angle = brief.all_angles[idx]

    # Exibe brief escolhido
    brief_text = (
        f"📋 *Brief Criativo*\n\n"
        f"*Ângulo:* {brief.chosen_angle.title}\n"
        f"*Hook:* _{brief.chosen_angle.hook}_\n"
        f"*Gatilho:* `{brief.chosen_angle.emotional_trigger}`\n"
        f"*Estrutura:* {brief.chosen_angle.structure}\n\n"
        f"*Mensagens-chave:*\n" + "\n".join(f"• {m}" for m in brief.key_messages) +
        f"\n\n*Estilo visual:* {brief.visual_style}\n"
        f"*Paleta:* {brief.visual_palette}\n"
        f"*Ritmo:* {brief.pacing_tip}"
    )
    if brief.engagement_tips:
        brief_text += "\n\n*Dicas:*\n" + "\n".join(f"• {t}" for t in brief.engagement_tips)

    await query.edit_message_text(brief_text[:4000], parse_mode="Markdown")

    # Cria projeto e gera script
    project = Project(
        topic=context.user_data["topic"],
        video_format=context.user_data["format"],
        desired_duration_sec=context.user_data["duration_sec"],
    )
    project.content_brief = brief
    project.raw_briefing = context.user_data.get("raw_briefing")
    project.dirs = file_manager.setup_project_dirs(project.topic)
    context.user_data["project"] = project

    msg = await query.message.reply_text("✍️ Gerando script…")
    try:
        await _generate_and_score_script(project, msg)
    except Exception as e:
        await msg.edit_text(f"❌ Erro ao gerar script: {e}")
        return ConversationHandler.END

    await msg.edit_text(
        _format_script(project),
        parse_mode="Markdown",
        reply_markup=approval_keyboard(),
    )

    # Score em background — não bloqueia o fluxo
    asyncio.create_task(
        _evaluate_score_background(project, query.message.chat_id, query.get_bot())
    )

    return SCRIPT_REVIEW


async def script_approved(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_reply_markup(None)

    project: Project = context.user_data["project"]
    brief = context.user_data["brief"]

    concepts = image_generator.suggest_image_concepts(project.script)

    if not concepts:
        msg = await query.message.reply_text("✅ Script aprovado! Gerando áudio…")
        return await _run_voice_and_video(msg, context)

    # Aprimora prompts de imagem com o brief
    msg = await query.message.reply_text("🎨 Aprimorando conceitos de imagem com o brief criativo…")
    try:
        improved = []
        content_scenes = project.script.content_scenes
        for i, c in enumerate(concepts):
            label = content_scenes[i].label if i < len(content_scenes) else f"Cena {i+1}"
            imp = await asyncio.to_thread(content_advisor.improve_image_prompt, c, brief, label)
            improved.append(imp)
        concepts = improved
    except Exception:
        pass

    await msg.delete()

    context.user_data["pending_concepts"] = concepts
    context.user_data["approved_concepts"] = []
    context.user_data["concept_index"] = 0

    return await _show_next_concept(query.message, context)


async def script_adjust(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()

    score = context.user_data["project"].script_score
    text = "✏️ *Ajuste do Script*\n\n"
    if score and score.improvements:
        text += "*Sugestões do agente:*\n" + "\n".join(f"• {i}" for i in score.improvements)
        if score.rewrite_suggestion:
            text += f"\n\n*Trecho para reescrever:*\n_{score.rewrite_suggestion}_"
    text += "\n\nEnvie sua instrução de ajuste (ou descreva o que mudar):"

    await query.edit_message_text(text[:4000], parse_mode="Markdown")
    return SCRIPT_FEEDBACK


async def receive_script_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    feedback = update.message.text.strip()
    project: Project = context.user_data["project"]
    msg = await update.message.reply_text("✍️ Regenerando script com ajustes…")

    try:
        await _generate_and_score_script(project, msg, feedback)
    except Exception as e:
        await msg.edit_text(f"❌ Erro: {e}")
        return SCRIPT_REVIEW

    await msg.edit_text(
        _format_script(project),
        parse_mode="Markdown",
        reply_markup=approval_keyboard(),
    )
    return SCRIPT_REVIEW


async def handle_concept_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    parts = query.data.split(":")

    # Aprovação das imagens geradas
    if parts[0] == "images":
        if parts[1] == "approve":
            await query.edit_message_reply_markup(None)
            msg = await query.message.reply_text("🎬 Gerando vídeos de cena com Veo 2…")
            return await _generate_scene_videos(msg, context)
        else:  # regenerate
            await query.edit_message_reply_markup(None)
            project: Project = context.user_data["project"]
            msg = await query.message.reply_text("🔄 Regenerando vídeos de cena…")
            project.animated_clip_paths = []
            return await _generate_scene_videos(msg, context)

    # Revisão de conceitos
    action = parts[1]
    idx = int(parts[2])
    concepts: list = context.user_data["pending_concepts"]

    await query.edit_message_reply_markup(None)

    if action == "approve":
        context.user_data["approved_concepts"].append(concepts[idx])
        context.user_data["concept_index"] += 1
        return await _show_next_concept(query.message, context)

    elif action == "remove":
        context.user_data["concept_index"] += 1
        await query.message.reply_text("❌ Conceito removido.")
        return await _show_next_concept(query.message, context)

    elif action == "edit":
        context.user_data["editing_concept_idx"] = idx
        await query.edit_message_text(
            f"✏️ *Editar conceito {idx + 1}*\n\n"
            f"Original: _{concepts[idx][:200]}_\n\n"
            f"Envie o novo texto (em inglês para melhor resultado no Imagen):",
            parse_mode="Markdown",
        )
        return CONCEPT_REVIEW


async def handle_concept_edit_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Recebe o texto editado de um conceito."""
    if "editing_concept_idx" not in context.user_data:
        return CONCEPT_REVIEW

    idx = context.user_data.pop("editing_concept_idx")
    context.user_data["pending_concepts"][idx] = update.message.text.strip()
    context.user_data["approved_concepts"].append(context.user_data["pending_concepts"][idx])
    context.user_data["concept_index"] += 1
    await update.message.reply_text("✅ Conceito atualizado.")
    return await _show_next_concept(update.message, context)


async def receive_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    project: Project = context.user_data["project"]

    if update.message.photo:
        photo = update.message.photo[-1]
        tmp = Path(tempfile.mkdtemp()) / "avatar_photo.jpg"
        file = await photo.get_file()
        await file.download_to_drive(str(tmp))
        project.avatar_photo_path = tmp
        msg = await update.message.reply_text("✅ Foto recebida! Enviando para Heygen…")
    else:
        msg = await update.message.reply_text("⏳ Gerando vídeo com avatar padrão…")

    return await _generate_heygen(msg, context)


async def skip_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    await query.edit_message_reply_markup(None)
    msg = await query.message.reply_text("⏳ Gerando vídeo com avatar padrão…")
    return await _generate_heygen(msg, context)


async def _generate_heygen(msg: Message, context: ContextTypes.DEFAULT_TYPE) -> int:
    project: Project = context.user_data["project"]

    try:
        await msg.edit_text(
            "🤖 Gerando vídeo com Heygen…\n"
            "_(isso pode levar 2–5 minutos — vou te avisar quando estiver pronto)_",
            parse_mode="Markdown",
        )
        project.avatar_video_path = await asyncio.to_thread(
            avatar_generator.create_avatar_video,
            project.script.raw_text,
            project.dirs["avatar"],
        )
    except Exception as e:
        await msg.edit_text(f"❌ Erro no Heygen: {e}")
        return ConversationHandler.END

    await msg.edit_text("🎬 Montando vídeo final…")
    try:
        project.final_video_path = await asyncio.to_thread(
            video_assembler.assemble_final_video, project
        )
    except Exception as e:
        await msg.edit_text(f"❌ Erro na montagem: {e}")
        return ConversationHandler.END

    size_mb = project.final_video_path.stat().st_size / (1024 * 1024)
    score_txt = (
        f"\n📊 Score de engajamento: *{project.script_score.overall}/10*"
        if project.script_score
        else ""
    )

    await msg.edit_text(
        f"✅ *Vídeo pronto!*{score_txt}\n\nEnviando o arquivo…",
        parse_mode="Markdown",
    )

    with open(project.final_video_path, "rb") as f:
        await msg.get_bot().send_video(
            chat_id=msg.chat_id,
            video=f,
            caption=(
                f"🎬 *{project.topic}*\n"
                f"📐 {FMT_NAMES[project.video_format]} · "
                f"⏱ {project.script.total_duration_sec:.0f}s"
                + (f" · 📊 {project.script_score.overall}/10" if project.script_score else "")
            ),
            parse_mode="Markdown",
            supports_streaming=True,
        )

    await msg.get_bot().send_message(
        chat_id=msg.chat_id,
        text="Quer criar outro vídeo? Use /start 🚀",
    )
    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("❌ Operação cancelada. Use /start para recomeçar.")
    context.user_data.clear()
    return ConversationHandler.END
