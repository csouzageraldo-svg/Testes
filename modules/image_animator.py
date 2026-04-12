from pathlib import Path
from typing import List, Tuple

import numpy as np
from moviepy import ImageClip, VideoFileClip, vfx
from PIL import Image

from models.script import Timestamp


def animate_images(
    image_paths: List[Path],
    timestamps: List[Timestamp],
    output_dir: Path,
    resolution: Tuple[int, int] = (1080, 1920),
    fps: int = 30,
) -> List[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    animated_paths = []

    image_timestamps = [ts for ts in timestamps if ts.element_type == "image"]

    for i, (img_path, ts) in enumerate(zip(image_paths, image_timestamps)):
        duration = ts.end_sec - ts.start_sec
        dest = output_dir / f"animated_{i:02d}.mp4"
        clip = _ken_burns_clip(img_path, duration, resolution, fps)
        clip.write_videofile(
            str(dest),
            fps=fps,
            codec="libx264",
            audio=False,
            logger=None,
        )
        clip.close()
        animated_paths.append(dest)

    return animated_paths


def _ken_burns_clip(
    image_path: Path,
    duration: float,
    resolution: Tuple[int, int],
    fps: int,
    zoom_ratio: float = 0.12,
) -> ImageClip:
    W, H = resolution

    img = Image.open(str(image_path)).convert("RGB")
    img = img.resize((W, H), Image.LANCZOS)
    img_array = np.array(img)

    def make_frame(t):
        factor = 1.0 + zoom_ratio * (t / duration)
        new_w = int(W * factor)
        new_h = int(H * factor)

        resized = Image.fromarray(img_array).resize((new_w, new_h), Image.LANCZOS)

        left = (new_w - W) // 2
        top = (new_h - H) // 2
        cropped = resized.crop((left, top, left + W, top + H))

        return np.array(cropped)

    clip = ImageClip(make_frame, duration=duration, is_mask=False)
    clip = clip.with_fps(fps)
    return clip
