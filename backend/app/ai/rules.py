"""Rule-based answers: the last fallback, and the simulated AI used during development.

Everything here is deterministic and offline, so the app always answers even when
both the local model and Gemini are down.
"""

import hashlib
import re
import unicodedata

from app.ai.formatting import parse_amount, pct, strip_amounts, vnd
from app.ai.interface import (
    AdviceRequest,
    FinancialSummary,
    RoastContext,
    RoastTrigger,
    Tone,
)
from app.ai.prompts import roast_facts
from app.ai.triggers import FIXED_COST_CATEGORIES


def _pick(options: list[str], seed: str) -> str:
    """Stable choice so tests and demos are reproducible."""
    digest = hashlib.sha256(seed.encode()).digest()
    return options[digest[0] % len(options)]


def _scope(ctx: RoastContext) -> str:
    return f"mục {ctx.category}" if ctx.category else "ngân sách cả tháng"


# ---------------------------------------------------------------- roast

T = RoastTrigger
_OPENERS: dict[Tone, dict[RoastTrigger, list[str]]] = {
    Tone.GENTLE: {
        T.BUDGET_80: [
            "Nhẹ nhàng nhắc bạn: {scope} đã dùng {usage} rồi đó.",
            "Bạn ơi, {scope} đã chạm mốc {usage}, mình chậm lại chút nhé.",
        ],
        T.BUDGET_100: [
            "{scope} đã vượt hạn mức ({usage}), không sao, mình cùng điều chỉnh nhé.",
            "Hạn mức của {scope} đã hết ({usage}), còn {days} ngày nữa mới sang tháng mới.",
        ],
        T.LARGE_EXPENSE: ["Khoản {amount} này lớn hơn hẳn mức chi thường ngày ({avg}) của bạn."],
        T.DAILY_SPIKE: ["Hôm nay {scope} đã {spent}, nhiều hơn hôm qua ({prev}) đó bạn."],
        T.REPEAT_TODAY: ["Đây là lần thứ {count} hôm nay bạn chi cho {scope} rồi, tổng {spent}."],
        T.SMALL_HABIT: ["{count} khoản nhỏ cho {scope} tháng này đã cộng lại thành {spent}."],
        T.SPENDING_STREAK: ["Bạn đã chi cho {scope} {count} ngày liên tiếp, tổng {spent}."],
        T.PAYDAY_SPLURGE: ["Lương {income} mới về {count} ngày mà đã chi {spent} ({usage}) rồi."],
        T.OVER_INCOME: ["Tháng này bạn đã chi {spent}, nhiều hơn thu nhập {income} rồi đó."],
        T.BURN_RATE: [
            "Với tốc độ hiện tại, {scope} sẽ hết trong khoảng {until_empty} ngày nữa, "
            "trong khi tháng còn {days} ngày."
        ],
    },
    Tone.HONEST: {
        T.BUDGET_80: [
            "Nói thẳng nhé: {scope} đã tiêu {spent}/{budget}, tức {usage}, mà còn {days} ngày.",
            "{scope} đã ăn mất {usage} ngân sách. Tốc độ này là hết tiền trước cuối tháng.",
        ],
        T.BUDGET_100: [
            "{scope} đã vượt ngân sách: {spent} trên mức {budget}.",
            "Hết ngân sách {scope} rồi ({usage}), và tháng vẫn còn {days} ngày.",
        ],
        T.LARGE_EXPENSE: ["Một lần chi {amount}, gấp mấy lần mức trung bình {avg} của bạn."],
        T.DAILY_SPIKE: [
            "Hôm qua {scope} {prev}, hôm nay {spent}: tăng {pct_prev} chỉ sau một ngày."
        ],
        T.REPEAT_TODAY: ["Lần thứ {count} trong ngày cho {scope}, tổng {spent}. Đây là thói quen."],
        T.SMALL_HABIT: ["{count} khoản lặt vặt cho {scope}, cộng lại {spent}. Tiền nhỏ, lỗ to."],
        T.SPENDING_STREAK: ["{count} ngày liền chi cho {scope}, tổng {spent}. Không có ngày nghỉ."],
        T.PAYDAY_SPLURGE: ["Lương {income} về {count} ngày, đã đi {spent}, tức {usage}."],
        T.OVER_INCOME: [
            "Chi {spent} trong khi thu {income}: tháng này bạn đang tiêu tiền không có."
        ],
        T.BURN_RATE: [
            "Tiêu kiểu này thì {scope} cạn sau {until_empty} ngày, còn tháng thì {days} ngày nữa."
        ],
    },
    Tone.SAVAGE: {
        T.BUDGET_80: [
            "Chúc mừng, {scope} đã cán mốc {usage} nhanh hơn cả tốc độ bạn kiếm tiền.",
            "{usage} ngân sách {scope} đã bay màu, ví bạn đang thở bằng oxy.",
        ],
        T.BUDGET_100: [
            "{scope} vượt ngân sách rồi: {spent} trên {budget}. Ngân sách chỉ là gợi ý với bạn à?",
            "Ví bạn vừa nộp đơn nghỉ việc: {scope} đã tiêu {usage} hạn mức.",
        ],
        T.LARGE_EXPENSE: [
            "{amount} một phát? Ví bạn vừa thấy cả cuộc đời lướt qua trước mắt.",
            "Bình thường bạn chi {avg}, giờ quất luôn {amount}. Đại gia ẩn danh lộ diện.",
        ],
        T.DAILY_SPIKE: [
            "Hôm qua {prev} còn chưa đủ, hôm nay {scope} lên luôn {spent}. "
            "Bạn đang tiêu hay đang mở tiệc?",
            "{prev} hôm qua, {spent} hôm nay: {scope} của bạn tăng trưởng nhanh hơn GDP.",
        ],
        T.REPEAT_TODAY: [
            "Lần thứ {count} hôm nay rồi đấy, {spent} cho {scope}. "
            "Bạn không mua nữa, bạn đang tích trữ.",
        ],
        T.SMALL_HABIT: [
            '{count} lần "có mấy chục thôi mà" cho {scope}, giờ thành {spent}. Mấy chục thôi mà.',
        ],
        T.SPENDING_STREAK: [
            "{count} ngày liên tiếp quẹt thẻ cho {scope}, tổng {spent}. "
            "Shipper sắp nhận bạn làm người nhà.",
        ],
        T.PAYDAY_SPLURGE: [
            "Lương {income} chưa kịp ấm ví, {count} ngày đã bay {spent}. "
            "Đây là lương hay tiền lì xì?",
        ],
        T.OVER_INCOME: [
            "Kiếm {income}, tiêu {spent}. Toán lớp 1 cũng biết ví bạn đang âm.",
        ],
        T.BURN_RATE: [
            "Với phong độ này, {scope} sẽ chết sau {until_empty} ngày, "
            "tháng còn {days} ngày để bạn ăn mì.",
        ],
    },
}

_TIPS: dict[RoastTrigger, list[str]] = {
    T.BUDGET_80: [
        "Thử đặt giới hạn {daily} mỗi ngày cho {days} ngày còn lại.",
        "Tuần này hãy hoãn các khoản không cần thiết trong {scope}.",
    ],
    T.BUDGET_100: [
        "Từ giờ đến cuối tháng, chỉ chi {scope} khi thật sự cần và ghi lại từng khoản.",
        "Xem lại các khoản lớn nhất trong {scope} và cắt bớt một khoản ngay hôm nay.",
    ],
    T.LARGE_EXPENSE: ["Lần sau với khoản lớn, hãy đợi 24 giờ rồi mới quyết định mua."],
    T.DAILY_SPIKE: ["Ngày mai cho {scope} một ngày nghỉ: nấu ở nhà hoặc mang cơm theo."],
    T.REPEAT_TODAY: ["Hôm nay dừng ở đây, lần mua tiếp theo để dành cho tuần sau."],
    T.SMALL_HABIT: ["Tuần này cắt một nửa số lần mua lặt vặt cho {scope}."],
    T.SPENDING_STREAK: ["Ngày mai là ngày không chi tiêu cho {scope}, xoá giỏ hàng đi."],
    T.PAYDAY_SPLURGE: [
        "Chuyển ngay một phần lương còn lại sang tài khoản tiết kiệm trước khi tiêu tiếp."
    ],
    T.OVER_INCOME: ["Từ giờ đến cuối tháng chỉ chi cho ăn uống thiết yếu và đi lại."],
    T.BURN_RATE: ["Giảm chi mỗi ngày cho {scope} ngay từ hôm nay để kéo dài đến cuối tháng."],
}


def roast(ctx: RoastContext) -> str:
    f = roast_facts(ctx)
    daily = f["daily_allowance"]
    fields = {
        "scope": _scope(ctx),
        "usage": pct(ctx.usage_pct),
        "spent": vnd(ctx.spent),
        "budget": vnd(ctx.budget),
        "amount": vnd(ctx.amount),
        "avg": vnd(ctx.average_expense),
        "days": ctx.days_left,
        "daily": vnd(daily) if daily else "thật chặt",
        "prev": vnd(ctx.previous_spent),
        "pct_prev": pct(f["pct_vs_previous"]),
        "count": ctx.count,
        "income": vnd(ctx.income),
        "until_empty": ctx.days_until_empty,
    }
    seed = f"{ctx.trigger}{ctx.tone}{ctx.category}{ctx.amount}"
    # Never mock rent, bills or tuition: state the facts instead.
    tone = Tone.HONEST if ctx.category in FIXED_COST_CATEGORIES else ctx.tone
    opener = _pick(_OPENERS[tone][ctx.trigger], seed).format(**fields)
    tip = _pick(_TIPS[ctx.trigger], seed + "tip").format(**fields)
    return f"{opener[0].upper()}{opener[1:]} {tip}"


# ---------------------------------------------------------------- advice


def _top_category(s: FinancialSummary) -> str | None:
    if not s.categories:
        return None
    top = max(s.categories, key=lambda c: c.spent)
    return f"{top.name} ({vnd(top.spent)})" if top.spent else None


def advice(req: AdviceRequest) -> str:
    s = req.summary
    lines: list[str] = []
    price = parse_amount(req.question)
    if price:
        lines.append(_afford(s, price))
    else:
        lines.append(
            f"Tháng {s.month} bạn đã thu {vnd(s.income)}, chi {vnd(s.expense)}, "
            f"còn lại {vnd(s.balance)}."
        )
        if top := _top_category(s):
            lines.append(f"Bạn chi nhiều nhất cho {top}.")
        if s.change_vs_previous_pct is not None:
            change = s.change_vs_previous_pct
            direction = "nhiều hơn" if change > 0 else "ít hơn"
            lines.append(f"So với tháng trước, bạn chi {direction} {abs(change)}%.")
    over = [c.name for c in s.categories if c.usage_pct is not None and c.usage_pct >= 100]
    if over:
        lines.append(f"Các mục đã vượt ngân sách: {', '.join(over)}.")
    lines.append("(Trợ lý đang dùng chế độ dự phòng, câu trả lời có thể ngắn gọn hơn bình thường.)")
    return " ".join(lines)


def _afford(s: FinancialSummary, price: int) -> str:
    budget_left = (s.total_budget - s.expense) if s.total_budget is not None else None
    if s.balance < price:
        return (
            f"Khoản {vnd(price)} lớn hơn số dư tháng này ({vnd(s.balance)}), "
            "nên tạm thời chưa nên mua."
        )
    if budget_left is not None and budget_left < price:
        return (
            f"Bạn đủ tiền ({vnd(s.balance)}) nhưng ngân sách tháng chỉ còn {vnd(budget_left)}, "
            f"mua {vnd(price)} sẽ vượt kế hoạch. Cân nhắc để sang tháng sau."
        )
    return (
        f"Số dư {vnd(s.balance)} đủ cho khoản {vnd(price)}. "
        "Hãy chắc rằng bạn vẫn giữ lại một khoản dự phòng sau khi mua."
    )


# ---------------------------------------------------------------- monthly report


def report(s: FinancialSummary) -> dict[str, str]:
    top = _top_category(s)
    headline = f"Tháng {s.month}: chi {vnd(s.expense)}, " + (
        "còn dư " + vnd(s.balance) if s.balance >= 0 else "âm " + vnd(-s.balance)
    )
    commentary = f"Bạn chi nhiều nhất cho {top}." if top else "Tháng này chưa có khoản chi nào."
    if s.change_vs_previous_pct is not None:
        commentary += f" Mức chi thay đổi {s.change_vs_previous_pct}% so với tháng trước."
    if s.categories:
        biggest = max(s.categories, key=lambda c: c.spent)
        tip = f"Tháng tới, thử đặt ngân sách cho mục {biggest.name} thấp hơn 10% so với tháng này."
    else:
        tip = "Hãy ghi lại mọi khoản chi trong tháng tới để có bức tranh đầy đủ."
    return {"headline": headline, "commentary": commentary, "saving_tip": tip}


# ---------------------------------------------------------------- quick entry

# Keywords for the default categories (Vietnamese names agreed with Khải in the contract).
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Ăn uống": ["an", "com", "pho", "bun", "tra sua", "cafe", "ca phe", "lunch", "dinner",
                "breakfast", "banh", "nuoc ngot", "nuoc mia", "do an", "an trua", "an toi",
                "an sang", "tra da", "lau", "nuong"],
    "Di chuyển": ["grab", "be", "xang", "taxi", "xe", "bus", "gui xe", "ve tau", "ve may bay"],
    "Nhà ở": ["tien nha", "thue nha", "tien phong", "phong tro"],
    "Hóa đơn": ["dien", "nuoc sinh hoat", "internet", "wifi", "dien thoai", "4g", "hoa don"],
    "Mua sắm": ["ao", "quan", "giay", "shopee", "lazada", "tiki", "mua"],
    "Giải trí": ["phim", "game", "netflix", "spotify", "karaoke", "du lich", "concert"],
    "Sức khỏe": ["thuoc", "kham", "benh vien", "gym", "nha khoa"],
    "Giáo dục": ["hoc phi", "sach", "khoa hoc", "course", "giao trinh"],
    "Lương": ["luong", "salary"],
    "Thưởng": ["thuong", "bonus"],
}  # fmt: skip
INCOME_KEYWORDS = ["luong", "thuong", "nhan tien", "duoc cho", "thu nhap", "salary", "bonus",
                   "hoan tien", "ban duoc"]  # fmt: skip


def strip_accents(text: str) -> str:
    text = text.lower().replace("đ", "d")
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _has(words: str, keyword: str) -> bool:
    return re.search(rf"\b{re.escape(keyword)}\b", words) is not None


def guess_kind(text: str) -> str:
    plain = strip_accents(text)
    return "income" if any(_has(plain, k) for k in INCOME_KEYWORDS) else "expense"


def guess_category(text: str, categories: list[str]) -> str:
    plain = strip_accents(text)
    by_plain = {strip_accents(c): c for c in categories}
    # A user's own category named in the text wins, e.g. "cafe 30k" with a custom "Cafe".
    for plain_name, name in by_plain.items():
        if _has(plain, plain_name):
            return name
    for default_name, keywords in CATEGORY_KEYWORDS.items():
        match = by_plain.get(strip_accents(default_name))
        if match and any(_has(plain, k) for k in keywords):
            return match
    return by_plain.get("khac", categories[-1] if categories else "Khác")


def entry_note(text: str) -> str:
    return strip_amounts(text) or text.strip()
