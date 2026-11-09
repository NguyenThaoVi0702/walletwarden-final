import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useChat } from "../api/hooks";
import type { ChatTurn, ProviderName } from "../api/types";
import { Button, PageHeader } from "../components/ui";
import { useRoast } from "../roast/context";

export const AI_DISCLAIMER =
  "WalletWarden chỉ đưa ra gợi ý chung về chi tiêu, không phải tư vấn tài chính chuyên nghiệp.";

const MAX_QUESTION = 500;
const STORAGE_KEY = "ww_chat";

/** ID tăng dần (Date.now() có thể trùng khi mock trả lời tức thì). */
let seq = Date.now();
const nextId = () => ++seq;

const SUGGESTIONS = [
  "Tháng này mình tiêu nhiều nhất vào đâu?",
  "Làm sao để tiết kiệm thêm 1 triệu mỗi tháng?",
  "Mình có đang vượt ngân sách không?",
];

interface Message extends ChatTurn {
  id: number;
  provider?: ProviderName;
  fallback?: boolean;
  /** Tin nhắn là một khoản thu/chi và backend đã ghi thành giao dịch. */
  logged?: boolean;
  /** Câu trả lời lỗi (429, mất mạng…): không gửi vào history. */
  error?: boolean;
}

function loadMessages(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export default function AdvisorPage() {
  const [messages, setMessages] = useState<Message[]>(loadMessages);
  const [input, setInput] = useState("");
  const chat = useChat();
  const { watchForRoast } = useRoast();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {
      // trình duyệt chặn storage: chỉ mất lịch sử khi chuyển trang
    }
    bottom.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages, chat.isPending]);

  /** `base` = các tin nhắn đã có trước câu hỏi này (retry truyền bản đã bỏ câu lỗi). */
  const ask = (question: string, base: Message[] = messages) => {
    const q = question.trim().slice(0, MAX_QUESTION);
    if (!q || chat.isPending) return;
    // History = các lượt hỏi/đáp thành công trước đó (hook tự cắt còn 6 lượt gần nhất).
    const history: ChatTurn[] = base
      .filter((m) => !m.error)
      .map(({ role, content }) => ({ role, content }));
    setMessages([...base, { id: nextId(), role: "user", content: q }]);
    setInput("");
    chat.mutate(
      { question: q, history },
      {
        onSuccess: (reply) => {
          if (reply.roast_pending) watchForRoast();
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: reply.text,
              provider: reply.provider,
              fallback: reply.fallback,
              logged: Boolean(reply.transaction),
            },
          ]);
        },
        onError: (err) =>
          setMessages((prev) => [
            ...prev,
            {
              id: nextId(),
              role: "assistant",
              content: errorMessage(err),
              error: true,
            },
          ]),
      },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  /** Hỏi lại câu gần nhất bị lỗi. */
  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    ask(
      lastUser.content,
      messages.filter((m) => m.id !== lastUser.id && !m.error),
    );
  };

  const clear = () => {
    setMessages([]);
    chat.reset();
  };

  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col md:min-h-[calc(100svh-4rem)]">
      <PageHeader
        title="Trợ lý AI"
        subtitle="Hỏi bất cứ điều gì về chi tiêu của bạn"
        actions={
          messages.length > 0 && (
            <Button variant="ghost" onClick={clear}>
              Cuộc trò chuyện mới
            </Button>
          )
        }
      />

      <div className="flex-1 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-navy/5 md:p-6">
            <img
              src="/logo-64.png"
              alt=""
              width={48}
              height={48}
              className="mx-auto rounded-xl"
            />
            <p className="mt-2 font-semibold">
              Mình có thể giúp gì cho ví của bạn?
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-navy/15 px-4 py-2 text-sm hover:border-green hover:bg-green-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div
                className={`max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm shadow-sm ring-1 ${
                  m.error
                    ? "bg-danger/10 text-danger ring-danger/20"
                    : "bg-white ring-navy/5"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.logged && (
                  <Link
                    to="/transactions"
                    className="mt-2 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green/40"
                  >
                    ✓ Đã ghi vào Giao dịch
                  </Link>
                )}
                {m.fallback && (
                  <span className="mt-2 inline-block rounded-full bg-navy-50 px-2 py-0.5 text-[11px] text-navy/70">
                    chế độ dự phòng
                  </span>
                )}
                {m.error && (
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-1 block text-xs font-semibold underline"
                  >
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          ),
        )}

        {chat.isPending && (
          <div className="flex justify-start">
            <p
              role="status"
              className="rounded-2xl rounded-bl-sm bg-white px-4 py-2.5 text-sm text-navy/60 shadow-sm ring-1 ring-navy/5"
            >
              <span className="inline-flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-green" />
                <span className="size-1.5 animate-bounce rounded-full bg-green [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-green [animation-delay:300ms]" />
              </span>{" "}
              Đang nghĩ…
            </p>
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Ô nhập dính đáy: trên điện thoại nằm ngay trên bottom nav. */}
      <div className="sticky bottom-16 -mx-4 mt-4 bg-surface px-4 pt-2 pb-2 md:bottom-0 md:mx-0 md:px-0 md:pb-0">
        <form onSubmit={onSubmit} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Câu hỏi cho trợ lý AI
          </label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_QUESTION}
            placeholder="Hỏi về chi tiêu của bạn…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-navy/20 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-green"
          />
          <Button type="submit" disabled={!input.trim() || chat.isPending}>
            Gửi
          </Button>
        </form>
        <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy/80">
          {AI_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
