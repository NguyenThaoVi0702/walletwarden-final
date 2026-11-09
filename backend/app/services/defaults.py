from sqlmodel import Session, select

from app.models import Category, User

# Icons are emoji: the frontend shows them as-is and the category form asks for one emoji.
# Colors: the frontend's validated chart palette, in its order (src/lib/categoryColor.ts).
# "Khác" is the neutral gray used for "other".
DEFAULT_CATEGORIES = (
    ("Ăn uống", "expense", "🍜", "#2a78d6"),
    ("Di chuyển", "expense", "🛵", "#eb6834"),
    ("Nhà ở", "expense", "🏠", "#1baf7a"),
    ("Hóa đơn", "expense", "🧾", "#eda100"),
    ("Mua sắm", "expense", "🛍️", "#e87ba4"),
    ("Giải trí", "expense", "🎮", "#008300"),
    ("Sức khỏe", "expense", "💊", "#6250d6"),
    ("Giáo dục", "expense", "📚", "#e34948"),
    ("Khác", "expense", "📦", "#8b8f98"),
    ("Lương", "income", "💼", "#008300"),
    ("Thưởng", "income", "🎁", "#eda100"),
    ("Thu nhập khác", "income", "💰", "#1baf7a"),
)
DEFAULT_COLORS = {name: color for name, _, _, color in DEFAULT_CATEGORIES}


def create_default_categories(session: Session, user: User) -> None:
    assert user.id is not None
    existing = set(session.exec(select(Category.name).where(Category.user_id == user.id)).all())
    for name, kind, icon, color in DEFAULT_CATEGORIES:
        if name not in existing:
            session.add(
                Category(
                    user_id=user.id, name=name, kind=kind, icon=icon, color=color, is_default=True
                )
            )
