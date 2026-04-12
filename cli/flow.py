from models.project import Project
from modules import (
    avatar_generator,
    content_advisor,
    image_generator,
    scene_video_generator,
    script_generator,
    video_assembler,
)
from cli import prompt
from utils import display, file_manager

TOTAL_STEPS = 10


def run_workflow() -> None:
    display.banner()

    # ── Passo 1: Inputs básicos ────────────────────────────────────────────────
    display.step(1, TOTAL_STEPS, "Tema e Formato")
    topic = prompt.ask_topic()
    fmt = prompt.ask_video_format()

    display.step(2, TOTAL_STEPS, "Duração")
    duration_sec = prompt.ask_duration()

    project = Project(
        topic=topic,
        video_format=fmt,
        desired_duration_sec=duration_sec,
    )
    project.dirs = file_manager.setup_project_dirs(topic)
    display.info(f"Pasta de saída: [bold]{project.dirs['base']}[/bold]")

    # ── Passo 2: Análise estratégica ──────────────────────────────────────────
    display.step(3, TOTAL_STEPS, "Análise Estratégica")
    display.progress("Analisando tema e criando brief com Gemini")
    brief = content_advisor.analyze_topic(topic, fmt, duration_sec)

    chosen_index = prompt.ask_angle_choice(brief.all_angles)
    brief.chosen_angle = brief.all_angles[chosen_index]
    project.content_brief = brief
    display.brief_panel(brief)

    # ── Passo 3: Script com engajamento ───────────────────────────────────────
    display.step(4, TOTAL_STEPS, "Geração de Script")
    feedback = ""
    while True:
        display.progress("Gerando script focado em engajamento com Gemini")
        project.script = script_generator.generate_script(project, feedback)
        display.script_table(project.script.scenes)
        display.timestamps_table(project.script.timestamps)

        display.progress("Avaliando engajamento do script")
        score = content_advisor.score_script(project.script.raw_text, topic, fmt)
        project.script_score = score
        display.score_panel(score)

        if prompt.ask_script_approval(score):
            break
        feedback = prompt.ask_script_feedback(score)

    # ── Passo 4: Vídeos de cena com Veo 2 ────────────────────────────────────
    display.step(5, TOTAL_STEPS, "Conceitos de Cena")
    concepts = image_generator.suggest_image_concepts(project.script)

    if concepts:
        if prompt.ask_improve_images(brief):
            display.progress("Aprimorando prompts com o brief criativo")
            concepts = [
                content_advisor.improve_image_prompt(c, brief, project.script.scenes[i + 1].label)
                for i, c in enumerate(concepts)
            ]

        display.concepts_panel(concepts)
        approved = prompt.ask_concept_approval(concepts)
        project.image_concepts = approved

        display.step(6, TOTAL_STEPS, "Geração de Vídeos de Cena (Veo 2)")
        display.progress(f"Gerando {len(approved)} vídeo(s) cinematográficos com Gemini Veo 2")
        project.animated_clip_paths = scene_video_generator.generate_scene_videos(
            approved,
            project.script.timestamps,
            project.dirs["animated"],
        )
        display.success(f"{len(project.animated_clip_paths)} clipe(s) de cena gerado(s).")
    else:
        display.info("Nenhuma cena de overlay no script. Continuando sem sobreposição.")

    # ── Passo 5: Foto do avatar ───────────────────────────────────────────────
    display.step(7, TOTAL_STEPS, "Foto do Avatar")
    project.avatar_photo_path = prompt.ask_avatar_photo()

    # ── Passo 6: Heygen (avatar + voz nativa) ────────────────────────────────
    display.step(8, TOTAL_STEPS, "Geração do Avatar (Heygen)")
    display.progress("Enviando para Heygen (pode levar alguns minutos)")
    project.avatar_video_path = avatar_generator.create_avatar_video(
        project.script.raw_text, project.dirs["avatar"]
    )
    display.success("Vídeo de avatar gerado.")

    # ── Passo 7: Montagem final ────────────────────────────────────────────────
    display.step(9, TOTAL_STEPS, "Montagem do Vídeo Final")
    display.progress("Montando vídeo final com moviepy")
    project.final_video_path = video_assembler.assemble_final_video(project)

    size_mb = project.final_video_path.stat().st_size / (1024 * 1024)
    score_label = (
        f"\n  Score de engajamento: [bold]{project.script_score.overall}/10[/bold]"
        if project.script_score else ""
    )
    display.success(
        f"Vídeo final pronto!{score_label}\n\n"
        f"  Caminho: [bold]{project.final_video_path}[/bold]\n"
        f"  Tamanho: {size_mb:.1f} MB"
    )
