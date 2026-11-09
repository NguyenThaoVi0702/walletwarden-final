import { describe, expect, it } from "vitest";
import { categoryIcon, DEFAULT_CATEGORY_ICON } from "./categoryIcon";

describe("categoryIcon", () => {
  it("giữ nguyên emoji", () => {
    expect(categoryIcon("🍜")).toBe("🍜");
    expect(categoryIcon("🛍️")).toBe("🛍️");
  });

  it("đổi tên icon cũ của backend sang emoji", () => {
    expect(categoryIcon("utensils")).toBe("🍜");
    expect(categoryIcon("shopping-bag")).toBe("🛍️");
    expect(categoryIcon("briefcase")).toBe("💼");
  });

  it("trống hoặc tên lạ → icon mặc định", () => {
    expect(categoryIcon("")).toBe(DEFAULT_CATEGORY_ICON);
    expect(categoryIcon(undefined)).toBe(DEFAULT_CATEGORY_ICON);
    expect(categoryIcon("rocket")).toBe(DEFAULT_CATEGORY_ICON);
  });
});
