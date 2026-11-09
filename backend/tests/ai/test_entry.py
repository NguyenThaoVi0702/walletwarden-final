from datetime import date

import pytest

from app.ai.entry import entry_day, is_entry_statement


@pytest.mark.parametrize(
    "text",
    [
        "Nay tôi ăn bánh cuốn hết 50k",
        "hôm qua đổ xăng 60k",
        "nhận lương 15 củ",
        "grab đi làm 35k",
        "mua áo 2 lốp rưỡi",
    ],
)
def test_statements_are_logged(text: str) -> None:
    assert is_entry_statement(text)


@pytest.mark.parametrize(
    "text",
    [
        "Mình có đủ tiền mua tai nghe 2 triệu không?",
        "Tháng này mua laptop 3 chai được không",
        "Làm sao để tiết kiệm thêm 1 triệu mỗi tháng?",
        "Có nên tiêu 500k cho concert",
        "Nếu mình ăn ngoài 100k mỗi ngày thì sao",
        "Ngân sách 5 triệu là đủ",
        "Tháng này mình tiêu nhiều nhất vào đâu?",
    ],
)
def test_questions_are_not_logged(text: str) -> None:
    assert not is_entry_statement(text)


def test_entry_day() -> None:
    today = date(2026, 11, 9)
    assert entry_day("Nay tôi ăn bánh cuốn hết 50k", today) == today
    assert entry_day("hôm qua đổ xăng 60k", today) == date(2026, 11, 8)
    assert entry_day("hôm kia đi chợ 200k", today) == date(2026, 11, 7)
