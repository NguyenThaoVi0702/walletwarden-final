import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { roastPolling } from "../roast/context";
import { renderApp } from "../test/render";

const original = { ...roastPolling };

beforeEach(() => {
  localStorage.setItem("ww_token", "mock-token-1");
  roastPolling.intervalMs = 20;
  roastPolling.maxMs = 2000;
});
afterEach(() => {
  Object.assign(roastPolling, original);
});

async function openForm() {
  const user = userEvent.setup();
  renderApp("/transactions?new=1");
  const dialogEl = await screen.findByRole("dialog", {
    name: "Thêm giao dịch",
  });
  const dialog = within(dialogEl);
  // chờ danh mục tải xong để select có option
  await dialog.findByRole("option", { name: /Ăn uống/ });
  return { user, dialog };
}

describe("Form giao dịch (F2)", () => {
  it("validate bằng Zod: thiếu số tiền / danh mục", async () => {
    const { user, dialog } = await openForm();
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    expect(
      await dialog.findByText("Vui lòng nhập số tiền."),
    ).toBeInTheDocument();
    expect(dialog.getByText("Vui lòng chọn danh mục.")).toBeInTheDocument();
  });

  it("số tiền không hiểu được → báo lỗi", async () => {
    const { user, dialog } = await openForm();
    await user.type(dialog.getByLabelText("Số tiền"), "abc");
    await user.click(dialog.getByRole("button", { name: "Lưu" }));
    expect(
      await dialog.findByText("Không hiểu số tiền, thử 45k hoặc 45000."),
    ).toBeInTheDocument();
  });

  it("gõ 45k → hiện = 45.000 ₫, lưu xong xuất hiện trong danh sách", async () => {
    const { user, dialog } = await openForm();
    await user.type(dialog.getByLabelText("Số tiền"), "45k");
    expect(dialog.getByText("= 45.000 ₫")).toBeInTheDocument();
    await user.selectOptions(dialog.getByLabelText("Danh mục"), "1");
    await user.type(
      dialog.getByLabelText("Ghi chú (không bắt buộc)"),
      "Trà sữa kiểm thử",
    );
    await user.click(dialog.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Trà sữa kiểm thử")).toBeInTheDocument();
  });

  it("nhập nhanh (F9): điền sẵn form nhưng không tự lưu", async () => {
    const { user, dialog } = await openForm();
    await user.type(
      dialog.getByLabelText("⚡ Nhập nhanh bằng AI"),
      "trà sữa 45k",
    );
    await user.click(dialog.getByRole("button", { name: "Điền" }));

    await waitFor(() =>
      expect(dialog.getByLabelText("Số tiền")).toHaveValue("45.000"),
    );
    expect(dialog.getByLabelText("Danh mục")).toHaveValue("1");
    expect(dialog.getByLabelText("Ghi chú (không bắt buộc)")).toHaveValue(
      "trà sữa",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // chưa lưu
  });
});

describe("Roast Mode (F7)", () => {
  it("khoản chi lớn → roast_pending → hiện toast, báo cáo, đóng thì mất", async () => {
    const { user, dialog } = await openForm();
    await user.type(dialog.getByLabelText("Số tiền"), "1tr");
    await user.selectOptions(dialog.getByLabelText("Danh mục"), "6");
    await user.click(dialog.getByRole("button", { name: "Lưu" }));

    const report = await screen.findByRole("button", {
      name: "Báo cáo tin nhắn này",
    });
    const toast = report.closest("[data-tone]") as HTMLElement;
    expect(toast).toHaveAttribute("data-tone", "honest"); // giọng của tài khoản demo

    await user.click(report);
    expect(
      await within(toast).findByText("Đã gửi báo cáo, cảm ơn bạn."),
    ).toBeInTheDocument();

    await user.click(
      within(toast).getByRole("button", { name: "Đóng thông báo" }),
    );
    await waitFor(() => expect(toast).not.toBeInTheDocument());
  });
});
