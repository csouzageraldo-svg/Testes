from pathlib import Path

from config import settings
from models.project import Project
from modules import (
    avatar_generator,
    image_animator,
    image_generator,
    script_generator,
    video_assembler,
    voice_synthesizer,
)
from cli import prompt
from utils import display, file_manager

TOTAL_STEPS = 13


def run_workflow() -> None:
    display.banner()

    # Passo 1-3: Coleta de inputs
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

    # Passo 4: Script
    display.step(3, TOTAL_STEPS, "Geração de Script")
    feedback = ""
    while True:
        display.progress("Gerando script com Gemini")
        project.script = script_generator.generate_script(project, feedback)
        display.script_table(project.script.scenes)
        display.timestamps_table(project.script.timestamps)

        if prompt.ask_script_approval():
            break
        feedback = prompt.ask_script_feedback()

    # Passo 5-7: Conceitos e imagens
    display.step(4, TOTAL_STEPS, "Conceitos de Imagem")
    concepts = image_generator.suggest_image_concepts(project.script)

    if concepts:
        display.concepts_panel(concepts)
        approved = prompt.ask_concept_approval(concepts)
        project.image_concepts = approved

        # Passo 8: Geração de imagens
        display.step(5, TOTAL_STEPS, "Geração de Imagens")
        display.progress(f"Gerando {len(approved)} imagem(ns) com Gemini Imagen 3")
        project.image_paths = image_generator.generate_images(
            approved, project.dirs["images"]
        )
        display.success(f"{len(project.image_paths)} imagem(ns) gerada(s).")

        # Passo 9: Animação Ken Burns
        display.step(6, TOTAL_STEPS, "Animação de Imagens")
        display.progress("Aplicando efeito Ken Burns nas imagens")
        project.animated_clip_paths = image_animator.animate_images(
            project.image_paths,
            project.script.timestamps,
            project.dirs["animated"],
            resolution=project.output_resolution,
        )
        display.success("Imagens animadas.")
    else:
        display.info("Nenhuma imagem de conteúdo no script. Continuando sem overlay.")

    # Passo 10: Síntese de voz
    display.step(7, TOTAL_STEPS, "Síntese de Voz")
    display.progress("Sintetizando voz com ElevenLabs")
    audio_path = project.dirs["audio"] / "narration.mp3"
    project.audio_path = voice_synthesizer.synthesize_voice(project.script, audio_path)
    display.success("Áudio gerado.")

    # Passo 11: Foto do avatar
    display.step(8, TOTAL_STEPS, "Foto do Avatar")
    project.avatar_photo_path = prompt.ask_avatar_photo()

    # Passo 12: Vídeo de avatar (Heygen)
    display.step(9, TOTAL_STEPS, "Geração do Vídeo com Avatar")
    display.progress("Enviando para Heygen (pode levar alguns minutos)")
    project.avatar_video_path = avatar_generator.create_avatar_video(
        project.audio_path, project.avatar_photo_path
    )
    display.success("Vídeo de avatar gerado.")

    # Passo 13: Montagem final
    display.step(10, TOTAL_STEPS, "Montagem do Vídeo Final")
    display.progress("Montando vídeo final com moviepy")
    project.final_video_path = video_assembler.assemble_final_video(project)

    size_mb = project.final_video_path.stat().st_size / (1024 * 1024)
    display.success(
        f"Vídeo final pronto!\n\n"
        f"  Caminho: [bold]{project.final_video_path}[/bold]\n"
        f"  Tamanho: {size_mb:.1f} MB"
    )
