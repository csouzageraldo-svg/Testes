"""
Geração de vídeos de cena com Gemini Veo 2.

Substitui o efeito Ken Burns estático por vídeos cinematográficos gerados
com IA — mais engajamento, zero custo extra de plataformas externas.
"""

import io
import time
from pathlib import Path
from typing import List

from google.genai import types

from config import settings
from models.script import Timestamp
from utils.gemini_client import get_client

VEO_MODEL = "veo-2.0-generate-001"
FALLBACK_TO_IMAGEN = True  # usa Imagen + Ken Burns se Veo 2 falhar


def generate_scene_videos(
    concepts: List[str],
    timestamps: List[Timestamp],
    output_dir: Path,
) -> List[Path]:
    """
    Gera um vídeo curto para cada cena usando Gemini Veo 2.
    Fallback automático para Imagen + Ken Burns se Veo 2 não estiver disponível.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    image_timestamps = [ts for ts in timestamps if ts.element_type == "image"]

    for i, (concept, ts) in enumerate(zip(concepts, image_timestamps)):
        duration = min(int(ts.end_sec - ts.start_sec), 8)  # Veo 2 max ~8s
        duration = max(duration, 3)  # mínimo 3s
        dest = output_dir / f"scene_{i:02d}.mp4"

        try:
            path = _generate_veo2_clip(concept, duration, dest)
            paths.append(path)
        except Exception as e:
            print(f"[Veo 2] Cena {i+1} falhou ({e}). Usando Imagen + Ken Burns.")
            if FALLBACK_TO_IMAGEN:
                path = _fallback_imagen_clip(concept, duration, dest)
                paths.append(path)

    return paths


def _generate_veo2_clip(prompt: str, duration: int, dest: Path) -> Path:
    """Gera um clipe de vídeo com Veo 2."""
    enhanced_prompt = (
        f"{prompt}. "
        f"Vertical format 9:16 portrait, cinematic, high quality, "
        f"no text, no watermarks, smooth motion, professional lighting."
    )

    operation = get_client().models.generate_videos(
        model=VEO_MODEL,
        prompt=enhanced_prompt,
        config=types.GenerateVideoConfig(
            aspect_ratio="9:16",
            number_of_videos=1,
            duration_seconds=duration,
            enhance_prompt=True,
        ),
    )

    # Poll até completar (máx 3 minutos)
    for _ in range(36):
        if operation.done:
            break
        time.sleep(5)
        operation = get_client().operations.get(operation)

    if not operation.done:
        raise TimeoutError("Veo 2 não completou em 3 minutos.")

    video_bytes = operation.response.generated_videos[0].video.video_bytes
    dest.write_bytes(video_bytes)
    return dest


def _fallback_imagen_clip(prompt: str, duration: int, dest: Path) -> Path:
    """Fallback: gera imagem com Imagen 3 e aplica Ken Burns via moviepy."""
    import io
    import numpy as np
    from PIL import Image
    from moviepy import ImageClip

    from google.genai import types as gtypes

    # Gera imagem com Imagen 3
    response = get_client().models.generate_images(
        model=settings.GEMINI_IMAGEN_MODEL,
        prompt=prompt,
        config=gtypes.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="9:16",
            output_mime_type="image/png",
        ),
    )

    image_bytes = response.generated_images[0].image.image_bytes
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = settings.OUTPUT_RESOLUTION
    img = img.resize((W, H), Image.LANCZOS)
    img_array = np.array(img)

    def make_frame(t):
        factor = 1.0 + 0.12 * (t / duration)
        new_w, new_h = int(W * factor), int(H * factor)
        resized = Image.fromarray(img_array).resize((new_w, new_h), Image.LANCZOS)
        left, top = (new_w - W) // 2, (new_h - H) // 2
        return np.array(resized.crop((left, top, left + W, top + H)))

    clip = ImageClip(make_frame, duration=duration, is_mask=False).with_fps(30)
    clip.write_videofile(str(dest), fps=30, codec="libx264", audio=False, logger=None)
    clip.close()
    return dest
