from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.prompt import Prompt, Confirm

from utils import display

console = Console()


def ask_topic() -> str:
    console.print()
    return Prompt.ask("[bold yellow]Qual é o tema do seu vídeo?[/bold yellow]")


def ask_video_format() -> str:
    console.print()
    console.print("[bold]Escolha o formato do vídeo:[/bold]")
    console.print("  [cyan]1.[/cyan] Stories")
    console.print("  [cyan]2.[/cyan] Reels  [dim](recomendado — maior alcance)[/dim]")
    console.print("  [cyan]3.[/cyan] TikTok")

    options = {"1": "stories", "2": "reels", "3": "tiktok"}
    choice = Prompt.ask("Formato", choices=["1", "2", "3"], default="2")
    return options[choice]


def ask_duration() -> float:
    console.print()
    console.print("[dim]Dica: 30-60s tem maior retenção para Reels/TikTok. 60-90s para Stories com mais conteúdo.[/dim]")
    while True:
        raw = Prompt.ask(
            "[bold yellow]Duração desejada em minutos?[/bold yellow] [dim](ex: 0.5 = 30s, 1 = 60s)[/dim]",
            default="1",
        )
        try:
            minutes = float(raw)
            if minutes <= 0:
                display.error("A duração deve ser maior que zero.")
                continue
            return minutes * 60
        except ValueError:
            display.error(f"Valor inválido: '{raw}'. Digite um número como 0.5 ou 1.")


def ask_angle_choice(angles: list) -> int:
    """Apresenta os ângulos sugeridos e retorna o índice escolhido."""
    console.print()
    display.angles_table(angles)
    console.print()
    console.print(
        "[dim]O ângulo recomendado está destacado. Você pode escolher outro ou "
        "deixar o agente decidir pelo melhor para engajamento.[/dim]"
    )
    choices = [str(i + 1) for i in range(len(angles))]
    choice = Prompt.ask(
        f"[bold]Escolha o ângulo[/bold] [dim](1-{len(angles)}, Enter = recomendado)[/dim]",
        choices=choices,
        default="1",
    )
    return int(choice) - 1


def ask_script_approval(score=None) -> bool:
    console.print()
    if score and score.overall < 7:
        console.print(
            f"[yellow]⚠ Score de engajamento: {score.overall}/10 — "
            "considere regenerar com as sugestões acima.[/yellow]"
        )
    return Confirm.ask("[bold]Aprovar este script e continuar?[/bold]", default=True)


def ask_script_feedback(score=None) -> str:
    if score and score.improvements:
        console.print("\n[bold yellow]Sugestões do agente para este script:[/bold yellow]")
        for imp in score.improvements:
            console.print(f"  → {imp}")
        if score.rewrite_suggestion:
            console.print(f"\n[bold red]Trecho sugerido para reescrita:[/bold red] {score.rewrite_suggestion}")
        console.print()

    return Prompt.ask(
        "[yellow]O que deve ser ajustado? [dim](Enter para usar as sugestões acima)[/dim][/yellow]",
        default="Aplique as sugestões de melhoria do agente",
    )


def ask_concept_approval(concepts: List[str]) -> List[str]:
    approved = []
    console.print()
    console.print("[bold]Revise cada conceito de imagem:[/bold]")
    console.print("[dim]Opções: [S] Aprovar  [E] Editar  [N] Remover[/dim]\n")

    for i, concept in enumerate(concepts):
        console.print(f"[bold cyan]{i+1}.[/bold cyan] {concept}")
        choice = Prompt.ask("  Ação", choices=["s", "e", "n"], default="s").lower()

        if choice == "s":
            approved.append(concept)
        elif choice == "e":
            edited = Prompt.ask("  Novo conceito", default=concept)
            approved.append(edited)

    if not approved:
        display.error("Nenhum conceito aprovado. Pelo menos 1 é necessário.")
        return ask_concept_approval(concepts)

    return approved


def ask_avatar_photo() -> Optional[Path]:
    console.print()
    console.print("[bold]Foto para o avatar:[/bold]")
    console.print("[dim]Informe o caminho completo da sua foto (jpg/png) ou pressione Enter para pular.[/dim]")

    raw = Prompt.ask("Caminho da foto", default="")
    if not raw:
        return None

    path = Path(raw.strip())
    if not path.exists():
        display.error(f"Arquivo não encontrado: {path}")
        return ask_avatar_photo()

    if path.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        display.error("Formato inválido. Use jpg ou png.")
        return ask_avatar_photo()

    return path


def ask_improve_images(brief) -> bool:
    console.print()
    console.print(
        f"[dim]O agente pode aprimorar os prompts de imagem com base no brief visual: "
        f"[bold]{brief.visual_style}[/bold] / paleta: [bold]{brief.visual_palette}[/bold][/dim]"
    )
    return Confirm.ask(
        "[bold]Aprimorar prompts de imagem automaticamente?[/bold]",
        default=True,
    )
