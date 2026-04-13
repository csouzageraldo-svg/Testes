"""
Entry point do bot Telegram — CGAvVid_bot
Execute: python bot_main.py
"""

from telegram import BotCommand
from telegram.ext import (
    Application,
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ConversationHandler,
    MessageHandler,
    filters,
)

from config import settings
from bot.handlers import (
    cancel,
    handle_concept_callback,
    handle_concept_edit_text,
    receive_angle,
    receive_briefing,
    receive_duration,
    receive_format,
    receive_mode,
    receive_photo,
    receive_script_feedback,
    receive_topic,
    script_adjust,
    script_approved,
    skip_photo,
    start,
)
from bot.states import (
    ANGLE,
    BRIEFING,
    CONCEPT_REVIEW,
    DURATION,
    FORMAT,
    MODE,
    PHOTO,
    SCRIPT_FEEDBACK,
    SCRIPT_REVIEW,
    TOPIC,
)


def build_application() -> Application:
    app = ApplicationBuilder().token(settings.TELEGRAM_BOT_TOKEN).build()

    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            MODE: [
                CallbackQueryHandler(receive_mode, pattern=r"^mode:"),
            ],
            TOPIC: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_topic)
            ],
            BRIEFING: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_briefing)
            ],
            FORMAT: [
                CallbackQueryHandler(receive_format, pattern=r"^format:")
            ],
            DURATION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_duration)
            ],
            ANGLE: [
                CallbackQueryHandler(receive_angle, pattern=r"^angle:")
            ],
            SCRIPT_REVIEW: [
                CallbackQueryHandler(script_approved, pattern=r"^script:approve$"),
                CallbackQueryHandler(script_adjust, pattern=r"^script:adjust$"),
            ],
            SCRIPT_FEEDBACK: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_script_feedback)
            ],
            CONCEPT_REVIEW: [
                CallbackQueryHandler(handle_concept_callback, pattern=r"^(concept|images):"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, handle_concept_edit_text),
            ],
            PHOTO: [
                MessageHandler(filters.PHOTO, receive_photo),
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_photo),
                CallbackQueryHandler(skip_photo, pattern=r"^photo:skip$"),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    app.add_handler(conv_handler)
    return app


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands([
        BotCommand("start", "Criar novo vídeo"),
        BotCommand("cancel", "Cancelar operação atual"),
    ])


def _start_keepalive(port: int = 8080) -> None:
    """Servidor HTTP mínimo para manter o Replit acordado."""
    from http.server import BaseHTTPRequestHandler, HTTPServer
    import threading

    class _Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK - CGAvVid_bot running")
        def log_message(self, *args):
            pass

    server = HTTPServer(("0.0.0.0", port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"🌐 Keep-alive: http://0.0.0.0:{port}/")


def main() -> None:
    _start_keepalive()
    app = build_application()
    app.post_init = post_init
    print(f"🤖 CGAvVid_bot iniciado. Acesse t.me/CGAvVid_bot no Telegram.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
