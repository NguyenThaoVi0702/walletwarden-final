import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render";

beforeEach(() => {
  localStorage.setItem("ww_token", "mock-token-1");
});

describe("Cài đặt: đổi tên hiển thị", () => {
  it("đổi tên và hiện tên mới", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(
      await screen.findByRole("button", { name: "Đổi tên hiển thị" }),
    );
    const input = screen.getByLabelText("Tên hiển thị");
    await user.clear(input);
    await user.type(input, "Vi Nguyễn");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    // Tên mới hiện ở thẻ tài khoản (và ở header nếu có).
    expect((await screen.findAllByText("Vi Nguyễn")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Tên hiển thị")).not.toBeInTheDocument();
  }, 15_000);

  it("không cho lưu tên trống", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(
      await screen.findByRole("button", { name: "Đổi tên hiển thị" }),
    );
    await user.clear(screen.getByLabelText("Tên hiển thị"));
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Vui lòng nhập tên.")).toBeInTheDocument();
  }, 15_000);
});
