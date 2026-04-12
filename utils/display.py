from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich import box

console = Console()


def banner() -> None:
    console.print(
        Panel(
            Text("🎬  Gerador de Vídeos Com Avatar", justify="center", style="bold white"),
            subtitle="by Carlos Avatar",
            style="bold blue",
            box=box.DOUBLE_EDGE,
        )
    )


def success(message: str) -> None:
    console.print(Panel(f"✅  {message}", style="bold green"))


def error(message: str) -> None:
    console.print(Panel(f"❌  {message}", style="bold red"))


def info(message: str) -> None:
    console.print(f"[cyan]ℹ[/cyan]  {message}")


def step(number: int, total: int, label: str) -> None:
    console.rule(f"[bold yellow]Passo {number}/{total} — {label}[/bold yellow]")


def progress(label: str) -> None:
    console.print(f"[bold magenta]⏳[/bold magenta]  {label}...")


def script_table(scenes: list) -> None:
    table = Table(title="Script Gerado", box=box.ROUNDED, show_lines=True)
    table.add_column("#", style="dim", width=4)
    table.add_column("Cena", style="bold")
    table.add_column("Duração", justify="right", style="cyan")
    table.add_column("Narração", style="white")

    for scene in scenes:
        table.add_row(
            str(scene.index),
            scene.label,
            f"{scene.duration_sec:.1f}s",
            scene.narration[:80] + ("..." if len(scene.narration) > 80 else ""),
        )

    console.print(table)


def timestamps_table(timestamps: list) -> None:
    table = Table(title="Timestamps do Vídeo", box=box.ROUNDED)
    table.add_column("Cena", style="bold")
    table.add_column("Início", justify="right", style="cyan")
    table.add_column("Fim", justify="right", style="cyan")
    table.add_column("Tipo", style="dim")

    for ts in timestamps:
        table.add_row(
            ts.label,
            f"{ts.start_sec:.1f}s",
            f"{ts.end_sec:.1f}s",
            ts.element_type,
        )

    console.print(table)


def concepts_panel(concepts: list) -> None:
    lines = "\n".join(f"  [bold cyan]{i+1}.[/bold cyan] {c}" for i, c in enumerate(concepts))
    console.print(Panel(lines, title="Conceitos de Imagem Sugeridos", style="blue"))
