import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { budgetLevel } from "../lib/budget";
import { BudgetProgress } from "./BudgetProgress";

function renderBar(spent: number, limit: number) {
  const { container } = render(
    <BudgetProgress label="Ăn uống" spent={spent} limit={limit} />,
  );
  const bar = screen.getByRole("progressbar", { name: "Ngân sách Ăn uống" });
  return {
    root: container.firstElementChild as HTMLElement,
    bar,
    fill: bar.firstElementChild as HTMLElement,
  };
}

describe("budgetLevel", () => {
  it.each([
    [0, "ok"],
    [79, "ok"],
    [80, "warning"],
    [99, "warning"],
    [100, "over"],
    [250, "over"],
  ] as const)("%d%% → %s", (pct, level) => {
    expect(budgetLevel(pct)).toBe(level);
  });
});

describe("BudgetProgress", () => {
  it("0%: thanh xanh lá, rộng 0", () => {
    const { root, bar, fill } = renderBar(0, 1_000_000);
    expect(root).toHaveAttribute("data-level", "ok");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(fill).toHaveClass("bg-green");
    expect(fill.style.width).toBe("0%");
    expect(screen.getByText("Còn 1.000.000 ₫ (0%)")).toBeInTheDocument();
  });

  it("80%: thanh vàng + chữ cảnh báo", () => {
    const { root, fill } = renderBar(800_000, 1_000_000);
    expect(root).toHaveAttribute("data-level", "warning");
    expect(fill).toHaveClass("bg-warning");
    expect(fill.style.width).toBe("80%");
    expect(screen.getByText(/Sắp chạm hạn mức/)).toBeInTheDocument();
  });

  it("> 100%: thanh đỏ, không tràn quá 100%, báo số tiền vượt", () => {
    const { root, bar, fill } = renderBar(1_500_000, 1_000_000);
    expect(root).toHaveAttribute("data-level", "over");
    expect(bar).toHaveAttribute("aria-valuenow", "150");
    expect(fill).toHaveClass("bg-danger");
    expect(fill.style.width).toBe("100%");
    expect(screen.getByText("⛔ Vượt 500.000 ₫ (150%)")).toBeInTheDocument();
  });
});
