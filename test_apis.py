"""
test_apis.py — Testa todas as conexões de API antes de rodar o bot.
Execute: python test_apis.py
"""
import os, sys, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

GEMINI_KEY  = os.getenv("GEMINI_API_KEY", "")
HEYGEN_KEY  = os.getenv("HEYGEN_API_KEY", "")
AVATAR_ID   = os.getenv("HEYGEN_AVATAR_ID", "")
VOICE_ID    = os.getenv("HEYGEN_VOICE_ID", "")
TG_TOKEN    = os.getenv("TELEGRAM_BOT_TOKEN", "")

ok = True

def check(label, passed, detail=""):
    global ok
    icon = "✅" if passed else "❌"
    print(f"  {icon} {label}", f"— {detail}" if detail else "")
    if not passed:
        ok = False

print("\n══════════════════════════════════")
print("  CGAvVid — Diagnóstico de APIs")
print("══════════════════════════════════\n")

# ── 1. Variáveis de ambiente ───────────────────────────────────────────────────
print("1. Variáveis de ambiente")
check(".env carregado",            Path(".env").exists())
check("GEMINI_API_KEY definida",   bool(GEMINI_KEY),  GEMINI_KEY[:12]+"..." if GEMINI_KEY else "AUSENTE")
check("HEYGEN_API_KEY definida",   bool(HEYGEN_KEY),  HEYGEN_KEY[:12]+"..." if HEYGEN_KEY else "AUSENTE")
check("HEYGEN_AVATAR_ID definido", bool(AVATAR_ID),   AVATAR_ID[:12]+"..." if AVATAR_ID else "AUSENTE")
check("HEYGEN_VOICE_ID definido",  bool(VOICE_ID),    VOICE_ID[:12]+"..." if VOICE_ID else "AUSENTE")
check("TELEGRAM_BOT_TOKEN def.",   bool(TG_TOKEN),    TG_TOKEN[:12]+"..." if TG_TOKEN else "AUSENTE")
print()

# ── 2. Gemini ──────────────────────────────────────────────────────────────────
print("2. Gemini API")
try:
    from google import genai
    client = genai.Client(api_key=GEMINI_KEY)
    candidates = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    model_ok = None
    for m in candidates:
        try:
            r = client.models.generate_content(model=m, contents="Responda só: OK")
            if r.text:
                model_ok = m
                break
        except Exception:
            pass
    check("Conexão Gemini",  model_ok is not None, model_ok or "nenhum modelo disponível")
except Exception as e:
    check("Conexão Gemini", False, str(e)[:80])
print()

# ── 3. Heygen — Listar avatares ────────────────────────────────────────────────
print("3. Heygen API")
try:
    import requests
    h = {"X-Api-Key": HEYGEN_KEY}

    r = requests.get("https://api.heygen.com/v2/avatars", headers=h, timeout=15)
    avatars = r.json().get("data", {}).get("avatars", []) if r.ok else []
    check(f"GET /v2/avatars ({r.status_code})", r.ok, f"{len(avatars)} avatar(s) encontrado(s)")

    avatar_exists = any(a["avatar_id"] == AVATAR_ID for a in avatars)
    check(f"AVATAR_ID '{AVATAR_ID[:16]}...' existe na conta", avatar_exists,
          "OK" if avatar_exists else "ID não encontrado nos avatares da conta")

    r2 = requests.get("https://api.heygen.com/v2/voices", headers=h, timeout=15)
    voices = r2.json().get("data", {}).get("voices", []) if r2.ok else []
    check(f"GET /v2/voices ({r2.status_code})", r2.ok, f"{len(voices)} voz(es) encontrada(s)")

    voice_exists = any(v["voice_id"] == VOICE_ID for v in voices)
    check(f"VOICE_ID '{VOICE_ID[:16]}...' existe na conta", voice_exists,
          "OK" if voice_exists else "ID não encontrado nas vozes da conta")

    if not voice_exists and voices:
        print(f"     Vozes disponíveis:")
        for v in voices[:5]:
            print(f"       - {v['voice_id']}  ({v.get('name','')})")

except Exception as e:
    check("Heygen API", False, str(e)[:80])
print()

# ── 4. Teste de submissão Heygen (sem gerar vídeo real) ────────────────────────
print("4. Heygen — Submissão de vídeo (teste rápido)")
try:
    import requests
    h = {"X-Api-Key": HEYGEN_KEY, "Content-Type": "application/json"}
    payload = {
        "video_inputs": [{
            "character": {"type": "avatar", "avatar_id": AVATAR_ID, "avatar_style": "normal"},
            "voice": {"type": "text", "input_text": "Teste de conexão.", "voice_id": VOICE_ID},
            "background": {"type": "color", "value": "#1a1a2e"},
        }],
        "dimension": {"width": 1080, "height": 1920},
        "test": True,
    }
    r = requests.post("https://api.heygen.com/v3/videos", json=payload, headers=h, timeout=30)
    data = r.json()
    video_id = data.get("data", {}).get("video_id", "")
    check(f"POST /v3/videos ({r.status_code})", r.ok,
          f"video_id={video_id[:16]}..." if video_id else str(data)[:100])
except Exception as e:
    check("POST /v3/videos", False, str(e)[:80])
print()

# ── Resultado final ────────────────────────────────────────────────────────────
print("══════════════════════════════════")
if ok:
    print("  ✅ Tudo OK — pode rodar o bot!")
else:
    print("  ❌ Há problemas — veja os itens marcados acima.")
print("══════════════════════════════════\n")
