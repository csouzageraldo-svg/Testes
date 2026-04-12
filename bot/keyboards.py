from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def start_mode_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📝 Tenho um tema", callback_data="mode:topic")],
        [InlineKeyboardButton("📋 Tenho um briefing pronto", callback_data="mode:briefing")],
    ])


def format_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📱 Stories", callback_data="format:stories"),
            InlineKeyboardButton("🎬 Reels ⭐", callback_data="format:reels"),
            InlineKeyboardButton("🎵 TikTok", callback_data="format:tiktok"),
        ]
    ])


def angles_keyboard(angles: list) -> InlineKeyboardMarkup:
    buttons = []
    for i, angle in enumerate(angles):
        label = f"⭐ {angle.title}" if i == 0 else f"{i + 1}. {angle.title}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"angle:{i}")])
    return InlineKeyboardMarkup(buttons)


def approval_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Aprovar", callback_data="script:approve"),
            InlineKeyboardButton("✏️ Ajustar", callback_data="script:adjust"),
        ]
    ])


def concept_keyboard(index: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Aprovar", callback_data=f"concept:approve:{index}"),
            InlineKeyboardButton("✏️ Editar", callback_data=f"concept:edit:{index}"),
            InlineKeyboardButton("❌ Remover", callback_data=f"concept:remove:{index}"),
        ]
    ])


def images_approval_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("✅ Continuar", callback_data="images:approve"),
            InlineKeyboardButton("🔄 Regenerar", callback_data="images:regenerate"),
        ]
    ])


def photo_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("⏭️ Pular (usar avatar padrão)", callback_data="photo:skip")]
    ])
