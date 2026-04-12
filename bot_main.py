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
    receive_duration,
    receive_format,
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
    CONCEPT_REVIEW,
    DURATION,
    FORMAT,
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
            TOPIC: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_topic)
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


def main() -> None:
    app = build_application()
    app.post_init = post_init
    print(f"🤖 CGAvVid_bot iniciado. Acesse t.me/CGAvVid_bot no Telegram.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
