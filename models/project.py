from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from modules.content_advisor import ContentBrief

from models.script import Script


@dataclass
class Project:
    topic: str
    video_format: str
    desired_duration_sec: float
    output_resolution: Tuple[int, int] = (1080, 1920)

    # Brief estratégico gerado pelo diretor criativo
    content_brief: Optional["ContentBrief"] = None

    # Preenchido progressivamente pelo workflow
    script: Optional[Script] = None
    script_score: Optional[object] = None  # ScriptScore
    image_concepts: List[str] = field(default_factory=list)
    image_paths: List[Path] = field(default_factory=list)
    animated_clip_paths: List[Path] = field(default_factory=list)
    audio_path: Optional[Path] = None
    avatar_video_path: Optional[Path] = None
    avatar_photo_path: Optional[Path] = None
    final_video_path: Optional[Path] = None
    dirs: Dict[str, Path] = field(default_factory=dict)
