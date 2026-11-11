import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../api/client";
import { useUpdateSettings } from "../api/hooks";
import type { Tone, User } from "../api/types";
import { useAuth } from "../auth/useAuth";
import { Icon } from "../components/Icon";
import { Alert, Button, Card, PageHeader, TextField } from "../components/ui";

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "gentle", label: "Nhẹ nhàng", hint: "Nhắc khéo, động viên" },
  { value: "honest", label: "Thẳng thắn", hint: "Nói thật, không vòng vo" },
  { value: "savage", label: "Cà khịa", hint: "Roast không thương tiếc" },
];

/** Account card: view and change the display name (used in the dashboard greeting). */
function AccountCard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const rename = useUpdateSettings();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.display_name);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setName(user.display_name);
    setError(null);
    rename.reset();
    setEditing(true);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    const value = name.trim();
    if (!value) return setError("Vui lòng nhập tên.");
    if (value.length > 80) return setError("Tối đa 80 ký tự.");
    if (value === user.display_name) return setEditing(false);
    rename.mutate(
      { display_name: value },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Card>
      <h2 className="font-semibold">Tài khoản</h2>
      {editing ? (
        <form noValidate onSubmit={save} className="mt-2 space-y-3">
          <TextField
            label="Tên hiển thị"
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            error={error ?? undefined}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={rename.isPending}>
              Lưu
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Huỷ
            </Button>
          </div>
          {rename.isError && <Alert>{errorMessage(rename.error)}</Alert>}
        </form>
      ) : (
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.display_name}</p>
            <p className="truncate text-sm text-navy/60">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            className="shrink-0 px-2! py-1!"
            onClick={start}
            aria-label="Đổi tên hiển thị"
          >
            Đổi tên
          </Button>
        </div>
      )}
      <Button variant="secondary" className="mt-4" onClick={onSignOut}>
        <Icon name="logout" className="size-4" /> Đăng xuất
      </Button>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const update = useUpdateSettings();
  if (!user) return null;

  return (
    <>
      <PageHeader title="Cài đặt" />
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <AccountCard user={user} onSignOut={signOut} />

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Roast Mode</h2>
              <p className="text-sm text-navy/60">
                AI nhắc (hoặc cà khịa) khi bạn tiêu quá tay.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={user.roast_enabled}
                disabled={update.isPending}
                onChange={(e) =>
                  update.mutate({ roast_enabled: e.target.checked })
                }
                aria-label="Bật Roast Mode"
              />
              <span className="h-6 w-11 rounded-full bg-navy/20 transition peer-checked:bg-green peer-focus-visible:ring-2 peer-focus-visible:ring-green" />
              <span className="absolute left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
            </label>
          </div>

          <fieldset
            className="mt-4 space-y-2"
            disabled={!user.roast_enabled || update.isPending}
          >
            <legend className="mb-1 text-sm font-medium">Giọng điệu</legend>
            {TONES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-navy/10 px-3 py-2 has-checked:border-green has-checked:bg-green-50 has-disabled:cursor-not-allowed has-disabled:opacity-60"
              >
                <input
                  type="radio"
                  name="tone"
                  value={t.value}
                  checked={user.roast_tone === t.value}
                  onChange={() => update.mutate({ roast_tone: t.value })}
                  className="accent-green"
                />
                <span className="text-sm">
                  <b>{t.label}</b>{" "}
                  <span className="text-navy/60">· {t.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {update.isError && (
            <div className="mt-3">
              <Alert>{errorMessage(update.error)}</Alert>
            </div>
          )}
        </Card>

        {/* Các trang không có trong bottom nav trên điện thoại */}
        <Card className="md:hidden">
          <ul className="divide-y divide-navy/5 text-sm">
            <li>
              <Link to="/categories" className="flex items-center gap-3 py-3">
                <Icon name="categories" /> Danh mục
              </Link>
            </li>
            <li>
              <Link to="/report" className="flex items-center gap-3 py-3">
                <Icon name="report" /> Báo cáo tháng
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
