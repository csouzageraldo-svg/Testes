import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict

from config import settings


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "video"


def setup_project_dirs(topic: str) -> Dict[str, Path]:
    slug = slugify(topic)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = settings.OUTPUT_DIR / f"{slug}_{timestamp}"

    dirs = {
        "base": base,
        "images": base / "images",
        "animated": base / "animated",
        "audio": base / "audio",
        "avatar": base / "avatar",
        "final": base / "final",
    }

    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)

    return dirs


def cleanup_temp(base_dir: Path) -> None:
    temp = base_dir / ".tmp"
    if temp.exists():
        shutil.rmtree(temp)
