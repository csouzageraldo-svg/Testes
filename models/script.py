from dataclasses import dataclass, field
from typing import List


@dataclass
class Timestamp:
    scene_index: int
    label: str
    start_sec: float
    end_sec: float
    element_type: str  # "avatar" | "image" | "overlay"


@dataclass
class Scene:
    index: int
    label: str
    narration: str
    image_prompt: str
    duration_sec: float
    timestamp: Timestamp


@dataclass
class Script:
    topic: str
    total_duration_sec: float
    opening: str
    closing: str
    scenes: List[Scene] = field(default_factory=list)
    timestamps: List[Timestamp] = field(default_factory=list)

    @property
    def raw_text(self) -> str:
        return " ".join(scene.narration for scene in self.scenes)

    @property
    def content_scenes(self) -> List[Scene]:
        return [s for s in self.scenes if s.index not in (0, len(self.scenes) - 1)]
