import pytest

from app.ai.formatting import big_numbers, parse_amount, strip_amounts, vnd
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


def test_roast_pronouns_are_softened() -> None:
    text = check_roast("Mày tiêu 4 ngày liền, tao chịu.", set())
    assert text == "Bạn tiêu 4 ngày liền, tôi chịu."


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


@pytest.mark.parametrize(
    "text", ["Đây là tự sát tài chính.", "Nhịn đói một bữa đi.", "Bỏ bữa tối nay."]
)
def test_unsafe_roast_advice_is_rejected(text: str) -> None:
    with pytest.raises(OutputRejectedError):
        check_roast(text, set())


def test_roast_drops_a_sentence_cut_off_by_max_tokens() -> None:
    assert check_roast("Vé concert 350.000đ. Ví bạn đang", {350_000}) == "Vé concert 350.000đ."
    assert check_roast("Ví toang rồi. Xoá app đi 🔥", set()) == "Ví toang rồi. Xoá app đi 🔥"
    assert check_roast("Ví toang rồi. Xoá app,", set()) == "Ví toang rồi."


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("3 lốp", 300_000),
        ("mượn 4 sọi", 400_000),
        ("áo 2 lít rưỡi", 250_000),
        ("trà sữa 5 xị", 50_000),
        ("2 lá", 20_000),
        ("điện thoại 5 củ", 5_000_000),
        ("Lương 15 Củ", 15_000_000),
        ("laptop 1 củ rưỡi", 1_500_000),
        ("2 chai", 2_000_000),
        ("nhà 1 tỏi", 1_000_000_000),
        ("1tr rưỡi", 1_500_000),
        # Counting words: a normal amount in the same text wins over the slang reading.
        ("2 chai bia 50k", 50_000),
        ("đổ 1 lít xăng 25k", 25_000),
        ("3 lá bài 30.000", 30_000),
    ],
)
def test_parse_money_slang(text: str, expected: int) -> None:
    assert parse_amount(text) == expected


def test_notes_drop_slang_amounts() -> None:
    assert strip_amounts("trà sữa 5 xị") == "trà sữa"
    assert strip_amounts("2 chai bia 50k") == "bia"
