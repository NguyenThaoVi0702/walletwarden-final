import pytest

from app.ai.formatting import big_numbers, parse_amount, vnd
from app.ai.guard import OutputRejectedError, check_advice, check_report, check_roast, clean


def test_vnd() -> None:
    assert vnd(1_500_000) == "1.500.000đ"
    assert vnd(-45_000) == "-45.000đ"
    assert vnd(None) == "chưa đặt"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("trà sữa 45k", 45_000),
        ("lunch 45K", 45_000),
        ("nhận lương 8tr", 8_000_000),
        ("điện thoại 1.2tr", 1_200_000),
        ("áo khoác 1tr2", 1_200_000),
        ("Can I afford a 2 triệu phone", 2_000_000),
        ("Can I afford a 2 million VND phone?", 2_000_000),
        ("tiền nhà 3,5 triệu", 3_500_000),
        ("grab 150.000", 150_000),
        ("cafe 30000đ", 30_000),
        ("ăn 50 nghìn", 50_000),
        ("mua 2 trà sữa", None),
        ("không có số", None),
    ],
)
def test_parse_amount(text: str, expected: int | None) -> None:
    assert parse_amount(text) == expected


def test_big_numbers() -> None:
    assert big_numbers("Chi 1.500.000đ, còn 25000 và 80%") == {1_500_000, 25_000}


def test_clean_strips_thinking_and_markdown() -> None:
    assert clean("<think>hmm</think> **Xin chào**  bạn") == "Xin chào bạn"


def test_roast_keeps_three_sentences_with_suggestion_last() -> None:
    text = "Câu một. Câu hai! Câu ba. Gợi ý: nấu ăn ở nhà."
    assert check_roast(text, set()) == "Câu một. Câu hai! Gợi ý: nấu ăn ở nhà."


@pytest.mark.parametrize("bad", ["Bạn ngu thật.", "Đồ óc chó.", "Trông bạn béo quá."])
def test_roast_rejects_personal_insults(bad: str) -> None:
    with pytest.raises(OutputRejectedError):
        check_roast(bad, set())


def test_roast_rejects_invented_numbers() -> None:
    with pytest.raises(OutputRejectedError, match="numbers"):
        check_roast("Bạn đã tiêu 9.999.000đ.", {2_050_000})
    assert check_roast("Bạn đã tiêu 2.050.000đ trong năm 2026.", {2_050_000})


def test_advice_rejects_empty() -> None:
    with pytest.raises(OutputRejectedError):
        check_advice("   <think>only thoughts</think> ")


def test_report_parses_json_inside_text() -> None:
    raw = 'Đây: {"headline": "Tháng ổn", "commentary": "Chi 5.400.000đ.", "saving_tip": "Nấu ăn."}'
    assert check_report(raw, {5_400_000})["headline"] == "Tháng ổn"
    with pytest.raises(OutputRejectedError):
        check_report('{"headline": "x"}', set())
