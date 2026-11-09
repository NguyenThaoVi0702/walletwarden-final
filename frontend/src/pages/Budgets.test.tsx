import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render";

beforeEach(() => {
  localStorage.setItem("ww_token", "mock-token-1");
});

const level = (name: string) =>
  screen
    .getByRole("progressbar", { name: `Ngân sách ${name}` })
    .parentElement?.getAttribute("data-level");

describe("Ngân sách (F4)", () => {
  it("hiện tiến độ từ dữ liệu mẫu", async () => {
    renderApp("/budgets");
    expect(
      await screen.findByRole("progressbar", {
        name: "Ngân sách Tổng chi tiêu",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Ngân sách Ăn uống" }),
    ).toBeInTheDocument();
  });

  it("đặt Ăn uống 100k → lưu → thanh chuyển sang vượt hạn mức", async () => {
    const user = userEvent.setup();
    renderApp("/budgets");
    const input = await screen.findByLabelText("🍜 Ăn uống");
    await user.clear(input);
    await user.type(input, "100k");
    await user.click(screen.getByRole("button", { name: "Lưu ngân sách" }));

    expect(await screen.findByText("✓ Đã lưu ngân sách.")).toBeInTheDocument();
    await waitFor(() => expect(level("Ăn uống")).toBe("over"));
  });

  it("số tiền sai → báo lỗi, không gửi", async () => {
    const user = userEvent.setup();
    renderApp("/budgets");
    const input = await screen.findByLabelText("🛵 Di chuyển");
    await user.clear(input);
    await user.type(input, "nhiều lắm");
    await user.click(screen.getByRole("button", { name: "Lưu ngân sách" }));
    expect(
      await screen.findByText("Số tiền không hợp lệ (vd: 1tr5)."),
    ).toBeInTheDocument();
  });
});
