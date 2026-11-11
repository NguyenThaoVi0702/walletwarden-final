import { useState } from "react";
import type { RoastAlert, Tone } from "../api/types";

/** Color by tone. */
const TONE_STYLE: Record<
  Tone,
  { box: string; label: string; muted: string; button: string }
> = {
  gentle: {
    box: "bg-green-50 border-green text-navy",
    label: "Nhẹ nhàng",
    muted: "text-navy/60",
    button: "hover:bg-green/15",
  },
  honest: {
    box: "bg-navy-50 border-navy text-navy",
    label: "Thẳng thắn",
    muted: "text-navy/60",
    button: "hover:bg-navy/10",
  },
  savage: {
    box: "bg-navy border-green text-white",
    label: "Cà khịa",
    muted: "text-white/70",
    button: "hover:bg-white/10",
  },
};

export function RoastToast({
  alert,
  onClose,
  onReport,
}: {
  alert: RoastAlert;
  onClose: () => void;
  onReport: () => Promise<void>;
}) {
  const tone: Tone = alert.tone in TONE_STYLE ? (alert.tone as Tone) : "honest";
  const style = TONE_STYLE[tone];
  const [reported, setReported] = useState(false);
  const [reporting, setReporting] = useState(false);

  const report = async () => {
    setReporting(true);
    try {
      await onReport();
      setReported(true);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div
      role="alert"
      data-tone={tone}
      className={`pointer-events-auto w-full rounded-xl border-2 p-4 shadow-lg ${style.box}`}
    >
      <div className="flex items-start gap-3">
        <img
          src="/logo-64.png"
          alt=""
          width={32}
          height={32}
          className="shrink-0 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${style.muted}`}
          >
            Roast · {style.label}
            {alert.category && ` · ${alert.category}`}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{alert.text}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {reported ? (
              <span className={style.muted}>Đã gửi báo cáo, cảm ơn bạn.</span>
            ) : (
              <button
                type="button"
                onClick={report}
                disabled={reporting}
                className={`rounded px-1 py-0.5 underline underline-offset-2 ${style.button}`}
              >
                Báo cáo tin nhắn này
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo"
          className={`grid size-7 shrink-0 place-items-center rounded-lg text-lg ${style.button}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}
