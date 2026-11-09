import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../test/render";

const signedIn = () => localStorage.setItem("ww_token", "mock-token-1");

describe("App shell", () => {
  it("đã có token → vào dashboard, hiện số liệu từ mock", async () => {
    signedIn();
    renderApp("/");
    expect(
      await screen.findByRole("heading", { name: /Chào Bạn Demo/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Chi theo danh mục")).toBeInTheDocument();
  });

  it("sidebar có đủ 7 mục, bottom nav có 5 mục", async () => {
    signedIn();
    renderApp("/");
    const sidebar = await screen.findByRole("navigation", {
      name: "Điều hướng chính",
    });
    const bottom = screen.getByRole("navigation", { name: "Điều hướng nhanh" });
    expect(within(sidebar).getAllByRole("link")).toHaveLength(7);
    expect(within(bottom).getAllByRole("link")).toHaveLength(5);
  });

  it("bấm menu → đổi trang", async () => {
    signedIn();
    const user = userEvent.setup();
    const { router } = renderApp("/");
    const sidebar = await screen.findByRole("navigation", {
      name: "Điều hướng chính",
    });
    await user.click(within(sidebar).getByRole("link", { name: "Trợ lý AI" }));
    expect(router.state.location.pathname).toBe("/advisor");
    expect(
      await screen.findByText(/không phải tư vấn tài chính chuyên nghiệp/),
    ).toBeInTheDocument();
  });

  it("token hết hạn (API trả 401) → về trang đăng nhập", async () => {
    localStorage.setItem("ww_token", "mock-token-999");
    const { router } = renderApp("/transactions");
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(localStorage.getItem("ww_token")).toBeNull();
  });

  it("đăng xuất → xoá token, về /login", async () => {
    signedIn();
    const user = userEvent.setup();
    const { router } = renderApp("/");
    const sidebar = await screen.findByRole("complementary");
    await user.click(
      within(sidebar).getByRole("button", { name: "Đăng xuất" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(localStorage.getItem("ww_token")).toBeNull();
  });
});
