from rich.columns import Columns
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


def angles_table(angles: list) -> None:
    table = Table(title="Ângulos Estratégicos Sugeridos", box=box.ROUNDED, show_lines=True)
    table.add_column("#", style="bold cyan", width=3)
    table.add_column("Ângulo", style="bold white", width=22)
    table.add_column("Hook (primeiros 3s)", style="yellow", width=40)
    table.add_column("Gatilho", style="magenta", width=14)
    table.add_column("Por que funciona", style="dim", width=36)

    for i, angle in enumerate(angles):
        table.add_row(
            str(i + 1),
            angle.title,
            f'"{angle.hook}"',
            angle.emotional_trigger,
            angle.why_it_works,
        )

    console.print(table)


def brief_panel(brief) -> None:
    lines = []
    lines.append(f"[bold cyan]Ângulo:[/bold cyan] {brief.chosen_angle.title}")
    lines.append(f"[bold cyan]Gatilho:[/bold cyan] {brief.chosen_angle.emotional_trigger}")
    lines.append(f"[bold cyan]Estrutura:[/bold cyan] {brief.chosen_angle.structure}")
    lines.append(f"\n[bold cyan]Mensagens-chave:[/bold cyan]")
    for i, msg in enumerate(brief.key_messages, 1):
        lines.append(f"  {i}. {msg}")
    lines.append(f"\n[bold cyan]Estilo visual:[/bold cyan] {brief.visual_style}")
    lines.append(f"[bold cyan]Paleta:[/bold cyan] {brief.visual_palette}")
    lines.append(f"[bold cyan]Ritmo:[/bold cyan] {brief.pacing_tip}")
    if brief.engagement_tips:
        lines.append(f"\n[bold cyan]Dicas de engajamento:[/bold cyan]")
        for tip in brief.engagement_tips:
            lines.append(f"  • {tip}")

    console.print(Panel("\n".join(lines), title="📋 Brief Criativo", style="blue", box=box.ROUNDED))


def score_panel(score) -> None:
    def bar(val: int) -> str:
        filled = "█" * val
        empty = "░" * (10 - val)
        color = "green" if val >= 7 else "yellow" if val >= 5 else "red"
        return f"[{color}]{filled}[/{color}][dim]{empty}[/dim] {val}/10"

    lines = [
        f"[bold]Score Geral:[/bold]     {bar(score.overall)}",
        f"[bold]Hook (1ºs 3s):[/bold]   {bar(score.hook_strength)}",
        f"[bold]Retenção:[/bold]        {bar(score.retention_score)}",
        f"[bold]CTA:[/bold]             {bar(score.cta_effectiveness)}",
    ]

    if score.strengths:
        lines.append("\n[bold green]Pontos fortes:[/bold green]")
        for s in score.strengths:
            lines.append(f"  ✓ {s}")

    if score.improvements:
        lines.append("\n[bold yellow]Sugestões de melhoria:[/bold yellow]")
        for imp in score.improvements:
            lines.append(f"  → {imp}")

    if score.rewrite_suggestion:
        lines.append(f"\n[bold red]Reescrita sugerida:[/bold red]\n  {score.rewrite_suggestion}")

    style = "green" if score.overall >= 7 else "yellow" if score.overall >= 5 else "red"
    console.print(Panel("\n".join(lines), title="📊 Avaliação de Engajamento", style=style, box=box.ROUNDED))


def script_table(scenes: list) -> None:
    table = Table(title="Script Gerado", box=box.ROUNDED, show_lines=True)
    table.add_column("#", style="dim", width=4)
    table.add_column("Cena", style="bold", width=22)
    table.add_column("Dur.", justify="right", style="cyan", width=6)
    table.add_column("Narração", style="white")

    for scene in scenes:
        table.add_row(
            str(scene.index),
            scene.label,
            f"{scene.duration_sec:.1f}s",
            scene.narration[:90] + ("…" if len(scene.narration) > 90 else ""),
        )

    console.print(table)


def timestamps_table(timestamps: list) -> None:
    table = Table(title="Timestamps do Vídeo", box=box.ROUNDED)
    table.add_column("Cena", style="bold")
    table.add_column("Início", justify="right", style="cyan")
    table.add_column("Fim", justify="right", style="cyan")
    table.add_column("Tipo", style="dim")

    for ts in timestamps:
        table.add_row(ts.label, f"{ts.start_sec:.1f}s", f"{ts.end_sec:.1f}s", ts.element_type)

    console.print(table)


def concepts_panel(concepts: list) -> None:
    lines = "\n".join(f"  [bold cyan]{i+1}.[/bold cyan] {c}" for i, c in enumerate(concepts))
    console.print(Panel(lines, title="🎨 Conceitos de Imagem", style="blue"))
