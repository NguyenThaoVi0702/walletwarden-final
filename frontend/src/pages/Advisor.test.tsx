import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp } from "../test/render";

beforeEach(() => {
  localStorage.setItem("ww_token", "mock-token-1");
  sessionStorage.clear();
});

async function ask(question: string) {
  const user = userEvent.setup();
  renderApp("/advisor");
  await user.type(
    await screen.findByLabelText("Câu hỏi cho trợ lý AI"),
    question,
  );
  await user.click(screen.getByRole("button", { name: "Gửi" }));
  return user;
}

describe("Chat AI (F6)", () => {
  it("gửi câu hỏi → nhận câu trả lời, disclaimer luôn hiện", async () => {
    await ask("Tháng này tiêu gì nhiều nhất?");
    expect(
      screen.getByText("Tháng này tiêu gì nhiều nhất?"),
    ).toBeInTheDocument();
    expect(await screen.findByText(/\(Trả lời mẫu\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/không phải tư vấn tài chính chuyên nghiệp/),
    ).toBeInTheDocument();
    expect(screen.queryByText("chế độ dự phòng")).not.toBeInTheDocument();
  });

  it("kể một khoản chi → backend ghi giao dịch → nhãn 'Đã ghi vào Giao dịch'", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          text: "Đã ghi khoản chi 50.000đ vào mục Ăn uống (bánh cuốn), hôm nay.",
          provider: "local",
          fallback: false,
          latency_ms: 900,
          transaction: {
            id: 99,
            kind: "expense",
            amount: 50000,
            category_id: 1,
            date: "2026-11-09",
            note: "bánh cuốn",
          },
          roast_pending: false,
        }),
      ),
    );
    await ask("Nay tôi ăn bánh cuốn hết 50k");
    expect(
      await screen.findByText(/Đã ghi khoản chi 50.000đ/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Đã ghi vào Giao dịch/ }),
    ).toHaveAttribute("href", "/transactions");
  });

  it("AIReply.fallback = true → nhãn chế độ dự phòng", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json({
          text: "Trả lời từ bộ luật",
          provider: "rules",
          fallback: true,
          latency_ms: 5,
        }),
      ),
    );
    await ask("Xin chào");
    expect(await screen.findByText("Trả lời từ bộ luật")).toBeInTheDocument();
    expect(screen.getByText("chế độ dự phòng")).toBeInTheDocument();
  });

  it("429 → thông báo thử lại sau X giây (đọc header Retry-After)", async () => {
    server.use(
      http.post("/api/ai/chat", () =>
        HttpResponse.json(
          { detail: "Too many requests" },
          { status: 429, headers: { "Retry-After": "12" } },
        ),
      ),
    );
    await ask("Câu hỏi thứ 11");
    expect(
      await screen.findByText("Bạn hỏi hơi nhanh, thử lại sau 12 giây."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("chỉ gửi tối đa 6 lượt gần nhất trong history", async () => {
    const sent: { question: string; history: { content: string }[] }[] = [];
    server.use(
      http.post("/api/ai/chat", async ({ request }) => {
        sent.push((await request.json()) as (typeof sent)[number]);
        return HttpResponse.json({
          text: `Đáp ${sent.length}`,
          provider: "fake",
          fallback: false,
          latency_ms: 1,
        });
      }),
    );
    const user = await ask("Câu 1");
    await screen.findByText("Đáp 1");
    for (let i = 2; i <= 5; i++) {
      await user.type(
        screen.getByLabelText("Câu hỏi cho trợ lý AI"),
        `Câu ${i}`,
      );
      await user.click(screen.getByRole("button", { name: "Gửi" }));
      await screen.findByText(`Đáp ${i}`);
    }
    const last = sent[sent.length - 1];
    expect(last.question).toBe("Câu 5");
    expect(last.history).toHaveLength(6);
    expect(last.history[0].content).toBe("Câu 2");
  });
});
