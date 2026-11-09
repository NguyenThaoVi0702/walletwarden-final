import { describe, expect, it } from "vitest";
import { ApiError, errorMessage } from "./client";

describe("errorMessage: dịch lỗi backend sang tiếng Việt", () => {
  it("câu detail đã biết → tiếng Việt", () => {
    expect(errorMessage(new ApiError(401, "Invalid email or password"))).toBe(
      "Email hoặc mật khẩu không đúng.",
    );
    expect(errorMessage(new ApiError(409, "Category is in use"))).toMatch(
      /không thể xoá/,
    );
  });

  it("câu detail chưa có trong bảng → hiện nguyên văn", () => {
    expect(errorMessage(new ApiError(400, "Something new"))).toBe(
      "Something new",
    );
  });

  it("422 của Pydantic (detail là mảng) → câu chung", () => {
    const detail = [
      {
        loc: ["body", "amount"],
        msg: "Input should be greater than 0",
        type: "greater_than",
      },
    ];
    expect(errorMessage(new ApiError(422, detail))).toBe(
      "Dữ liệu chưa hợp lệ, kiểm tra lại các ô đã nhập.",
    );
  });

  it("429 dùng Retry-After, không dùng câu của backend", () => {
    expect(
      errorMessage(
        new ApiError(429, "Bạn hỏi hơi nhanh, thử lại sau ít giây", 7),
      ),
    ).toBe("Bạn hỏi hơi nhanh, thử lại sau 7 giây.");
  });

  it("5xx và mất mạng", () => {
    expect(errorMessage(new ApiError(503, "Service Unavailable"))).toBe(
      "Service Unavailable",
    );
    expect(errorMessage(new ApiError(500, null))).toBe(
      "Máy chủ đang gặp sự cố, thử lại sau nhé.",
    );
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      "Không kết nối được máy chủ.",
    );
  });
});
