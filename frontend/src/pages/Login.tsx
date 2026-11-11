import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { errorMessage } from "../api/client";
import { loginRequest } from "../api/hooks";
import { useAuth } from "../auth/useAuth";
import { Alert, Button, TextField } from "../components/ui";

const schema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu."),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const login = useMutation({
    mutationFn: loginRequest,
    // GuestOnly redirects to `?next=` once there is a user.
    onSuccess: signIn,
  });

  return (
    <form
      onSubmit={handleSubmit((v) => login.mutate(v))}
      noValidate
      className="space-y-4"
    >
      <div>
        <h2 className="text-2xl font-bold">Đăng nhập</h2>
        <p className="text-sm text-navy/60">Chào mừng quay lại!</p>
      </div>

      {login.isError && <Alert>{errorMessage(login.error)}</Alert>}

      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <TextField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        {...register("password")}
        error={errors.password?.message}
      />

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>

      <p className="text-center text-sm">
        Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-semibold text-green-700 hover:underline"
        >
          Đăng ký
        </Link>
      </p>

      {import.meta.env.VITE_USE_MOCKS === "true" && (
        <p className="rounded-lg bg-surface px-3 py-2 text-xs text-navy/60">
          Chế độ mock: <b>demo@walletwarden.vn</b> / <b>matkhau123</b>
        </p>
      )}
    </form>
  );
}
