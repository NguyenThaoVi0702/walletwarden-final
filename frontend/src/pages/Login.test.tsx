import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../mocks/data";
import { renderApp } from "../test/render";

describe("Trang đăng nhập", () => {
  it("chưa đăng nhập mà vào trang cần auth → chuyển về /login?next=", async () => {
    const { router } = renderApp("/budgets");
    expect(
      await screen.findByRole("heading", { name: "Đăng nhập" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.state.location.search).toBe("?next=%2Fbudgets");
  });

  it("validate bằng Zod trước khi gọi API", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(await screen.findByRole("button", { name: "Đăng nhập" }));
    expect(await screen.findByText("Email không hợp lệ.")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập mật khẩu.")).toBeInTheDocument();
  });

  it("sai mật khẩu → API trả 401 → hiện lỗi, vẫn ở trang đăng nhập", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login");
    await user.type(await screen.findByLabelText("Email"), DEMO_EMAIL);
    await user.type(screen.getByLabelText("Mật khẩu"), "sai-mat-khau");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email hoặc mật khẩu không đúng.",
    );
    expect(router.state.location.pathname).toBe("/login");
    expect(localStorage.getItem("ww_token")).toBeNull();
  });

  it("đúng mật khẩu → lưu token và quay lại trang `next`", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login?next=%2Fsettings");
    await user.type(await screen.findByLabelText("Email"), DEMO_EMAIL);
    await user.type(screen.getByLabelText("Mật khẩu"), DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/settings"),
    );
    expect(localStorage.getItem("ww_token")).toBe("mock-token-1");
    expect(
      await screen.findByRole("heading", { name: "Cài đặt" }),
    ).toBeInTheDocument();
  });

  it("không cho `next` trỏ ra ngoài site", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/login?next=%2F%5Cevil.com");
    await user.type(await screen.findByLabelText("Email"), DEMO_EMAIL);
    await user.type(screen.getByLabelText("Mật khẩu"), DEMO_PASSWORD);
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
