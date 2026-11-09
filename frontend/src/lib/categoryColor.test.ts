import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  categoryColor,
  OTHER_COLOR,
  suggestColor,
} from "./categoryColor";

describe("categoryColor", () => {
  it("dùng màu người dùng chọn", () => {
    expect(categoryColor({ id: 1, name: "Ăn uống", color: "#123ABC" })).toBe(
      "#123abc",
    );
  });

  it("tài khoản cũ chưa có màu: danh mục mặc định lấy màu như backend", () => {
    expect(categoryColor({ id: 1, name: "Ăn uống", color: "" })).toBe(
      "#2a78d6",
    );
    expect(categoryColor({ id: 9, name: "Khác", color: "" })).toBe(OTHER_COLOR);
  });

  it("danh mục tự tạo chưa có màu: lấy theo bảng màu, cố định theo id", () => {
    const c = { id: 20, name: "Cà phê", color: "" };
    expect(CATEGORY_COLORS.map((x) => x.value)).toContain(categoryColor(c));
    expect(categoryColor(c)).toBe(categoryColor({ ...c }));
  });

  it("gợi ý màu chưa ai dùng cho danh mục mới", () => {
    const used = CATEGORY_COLORS.slice(0, 3).map((c, i) => ({
      id: i + 1,
      name: `x${i}`,
      color: c.value,
    }));
    expect(suggestColor(used)).toBe(CATEGORY_COLORS[3].value);
  });
});
