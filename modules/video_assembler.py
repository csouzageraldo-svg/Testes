from pathlib import Path
from typing import List, Tuple

from moviepy import (
    AudioFileClip,
    CompositeVideoClip,
    VideoFileClip,
    vfx,
)

from models.project import Project
from models.script import Timestamp

OVERLAY_HEIGHT_RATIO = 0.70  # top 70% for image overlay
AVATAR_LOWER_START_RATIO = 0.70  # avatar starts at 70% from top when image is active


def assemble_final_video(project: Project) -> Path:
    W, H = project.output_resolution
    overlay_h = int(H * OVERLAY_HEIGHT_RATIO)
    avatar_y = int(H * AVATAR_LOWER_START_RATIO)
    avatar_lower_h = H - avatar_y

    output_path = project.dirs["final"] / "video.mp4"

    avatar_clip = VideoFileClip(str(project.avatar_video_path))

    image_timestamps = [ts for ts in project.script.timestamps if ts.element_type == "image"]

    overlay_clips = []
    for animated_path, ts in zip(project.animated_clip_paths, image_timestamps):
        img_clip = (
            VideoFileClip(str(animated_path))
            .resized((W, overlay_h))
            .with_position((0, 0))
            .with_start(ts.start_sec)
            .with_end(min(ts.end_sec, avatar_clip.duration))
            .with_effects([vfx.CrossFadeIn(0.3), vfx.CrossFadeOut(0.3)])
        )
        overlay_clips.append(img_clip)

    avatar_full = (
        avatar_clip
        .resized((W, H))
        .with_position((0, 0))
    )

    if overlay_clips:
        avatar_lower = (
            avatar_clip
            .resized((W, avatar_lower_h))
            .with_position((0, avatar_y))
        )
        layers = [avatar_full] + overlay_clips + [avatar_lower]
    else:
        layers = [avatar_full]

    composite = CompositeVideoClip(layers, size=(W, H))

    audio = AudioFileClip(str(project.audio_path))
    final = composite.with_audio(audio)

    final.write_videofile(
        str(output_path),
        codec="libx264",
        audio_codec="aac",
        fps=30,
        preset="medium",
        threads=4,
        logger=None,
    )

    composite.close()
    avatar_clip.close()
    audio.close()

    return output_path
