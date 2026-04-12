import io
from pathlib import Path
from typing import List

import google.generativeai as genai
from PIL import Image

from config import settings
from models.script import Script

genai.configure(api_key=settings.GEMINI_API_KEY)


def suggest_image_concepts(script: Script) -> List[str]:
    return [
        scene.image_prompt
        for scene in script.scenes
        if scene.image_prompt
    ]


def generate_images(concepts: List[str], output_dir: Path) -> List[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    for i, concept in enumerate(concepts):
        dest = output_dir / f"image_{i:02d}.png"
        path = _generate_single(concept, dest)
        paths.append(path)

    return paths


def _generate_single(prompt: str, dest: Path) -> Path:
    from google import genai as google_genai
    from google.genai import types

    client = google_genai.Client(api_key=settings.GEMINI_API_KEY)

    response = client.models.generate_images(
        model=settings.GEMINI_IMAGEN_MODEL,
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio="9:16",
            output_mime_type="image/png",
        ),
    )

    image_bytes = response.generated_images[0].image.image_bytes
    img = Image.open(io.BytesIO(image_bytes))

    target_w, target_h = settings.OUTPUT_RESOLUTION
    img = img.resize((target_w, target_h), Image.LANCZOS)
    img.save(str(dest), "PNG")

    return dest
