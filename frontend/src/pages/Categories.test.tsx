import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { renderApp } from "../test/render";

beforeEach(() => {
  localStorage.setItem("ww_token", "mock-token-1");
});

describe("Danh mục (F3)", () => {
  it("thêm danh mục mới", async () => {
    const user = userEvent.setup();
    renderApp("/categories");
    await user.type(await screen.findByLabelText("Tên danh mục"), "Cà phê");
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    expect(await screen.findByText("Cà phê")).toBeInTheDocument();
  });

  it("trùng tên → hiện lỗi 409 từ API", async () => {
    const user = userEvent.setup();
    renderApp("/categories");
    await user.type(await screen.findByLabelText("Tên danh mục"), "Ăn uống");
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    expect(
      await screen.findByText("Danh mục này đã tồn tại."),
    ).toBeInTheDocument();
  });

  it("xoá danh mục đang có giao dịch → báo không xoá được", async () => {
    const user = userEvent.setup();
    renderApp("/categories");
    await user.click(
      await screen.findByRole("button", { name: "Xoá Ăn uống" }),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận xoá" }));
    expect(
      await screen.findByText(
        "Danh mục đang được dùng (có giao dịch hoặc ngân sách), không thể xoá.",
      ),
    ).toBeInTheDocument();
  });

  it("đổi tên danh mục", async () => {
    const user = userEvent.setup();
    renderApp("/categories");
    await user.click(await screen.findByRole("button", { name: "Sửa Khác" }));
    const row = screen.getByDisplayValue("Khác").closest("li") as HTMLElement;
    const name = within(row).getByLabelText("Tên danh mục");
    await user.clear(name);
    await user.type(name, "Linh tinh");
    await user.click(within(row).getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Linh tinh")).toBeInTheDocument();
  });

  it("chọn màu khi thêm và khi sửa danh mục", async () => {
    const user = userEvent.setup();
    renderApp("/categories");
    await user.type(await screen.findByLabelText("Tên danh mục"), "Cà phê");
    await user.click(screen.getByRole("button", { name: "Màu Tím" }));
    expect(screen.getByRole("button", { name: "Màu Tím" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    expect(await screen.findByText("Cà phê")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sửa Khác" }));
    const row = screen.getByDisplayValue("Khác").closest("li") as HTMLElement;
    const picker = within(row).getByRole("group", { name: "Màu của Khác" });
    await user.click(within(picker).getByRole("button", { name: "Màu Đỏ" }));
    await user.click(within(row).getByRole("button", { name: "Lưu" }));
    expect(
      await screen.findByRole("button", { name: "Sửa Khác" }),
    ).toBeInTheDocument();
  });
});
