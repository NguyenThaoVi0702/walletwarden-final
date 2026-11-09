import { describe, expect, it } from "vitest";
import { currentMonth, formatMonth, formatVND, parseMoney } from "./format";

describe("formatVND", () => {
  it("dùng dấu chấm ngăn cách hàng nghìn và ký hiệu ₫", () => {
    expect(formatVND(1_500_000)).toBe("1.500.000 ₫");
    expect(formatVND(0)).toBe("0 ₫");
    expect(formatVND(45_000)).toBe("45.000 ₫");
  });

  it("số âm", () => {
    expect(formatVND(-250_000)).toBe("-250.000 ₫");
  });
});

describe("parseMoney", () => {
  it.each([
    ["1500000", 1_500_000],
    ["1.500.000", 1_500_000],
    ["45k", 45_000],
    ["45 K", 45_000],
    ["1,5k", 1_500],
    ["45 nghìn", 45_000],
    ["1tr", 1_000_000],
    ["1tr2", 1_200_000],
    ["1tr25", 1_250_000],
    ["1,5tr", 1_500_000],
    ["2 triệu", 2_000_000],
    ["50.000đ", 50_000],
  ])("%s → %d", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "abc", "k", "1..2"])("không hiểu %j → null", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("tháng", () => {
  it("currentMonth trả YYYY-MM", () => {
    expect(currentMonth(new Date(2026, 10, 6))).toBe("2026-11");
    expect(currentMonth(new Date(2026, 0, 31))).toBe("2026-01");
  });

  it("formatMonth", () => {
    expect(formatMonth("2026-11")).toBe("Tháng 11/2026");
  });
});
