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
    console.print("  [cyan]2.[/cyan] Reels")
    console.print("  [cyan]3.[/cyan] TikTok")

    options = {"1": "stories", "2": "reels", "3": "tiktok"}
    while True:
        choice = Prompt.ask("Formato", choices=["1", "2", "3"], default="2")
        return options[choice]


def ask_duration() -> float:
    console.print()
    while True:
        raw = Prompt.ask("[bold yellow]Duração desejada em minutos?[/bold yellow] [dim](ex: 1.5)[/dim]", default="1")
        try:
            minutes = float(raw)
            if minutes <= 0:
                display.error("A duração deve ser maior que zero.")
                continue
            return minutes * 60
        except ValueError:
            display.error(f"Valor inválido: '{raw}'. Digite um número como 1 ou 1.5.")


def ask_script_approval() -> bool:
    console.print()
    return Confirm.ask("[bold]Aprovar este script e continuar?[/bold]", default=True)


def ask_script_feedback() -> str:
    return Prompt.ask("[yellow]O que deve ser ajustado no script?[/yellow]")


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
        # "n" = remove

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


def ask_regenerate() -> bool:
    return Confirm.ask("[yellow]Deseja regenerar com ajustes?[/yellow]", default=True)
