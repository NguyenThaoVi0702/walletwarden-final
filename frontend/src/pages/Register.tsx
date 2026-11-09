import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { errorMessage } from "../api/client";
import { registerRequest } from "../api/hooks";
import { useAuth } from "../auth/useAuth";
import { Alert, Button, TextField } from "../components/ui";

const schema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập tên hiển thị.")
      .max(50, "Tối đa 50 ký tự."),
    email: z.email("Email không hợp lệ."),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Mật khẩu nhập lại không khớp.",
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { signIn } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const signUp = useMutation({
    mutationFn: registerRequest,
    onSuccess: signIn,
  });

  return (
    <form
      onSubmit={handleSubmit(({ display_name, email, password }) =>
        signUp.mutate({ display_name, email, password }),
      )}
      noValidate
      className="space-y-4"
    >
      <div>
        <h2 className="text-2xl font-bold">Tạo tài khoản</h2>
        <p className="text-sm text-navy/60">
          Bắt đầu quản lý chi tiêu trong 1 phút.
        </p>
      </div>

      {signUp.isError && <Alert>{errorMessage(signUp.error)}</Alert>}

      <TextField
        label="Tên hiển thị"
        autoComplete="nickname"
        {...register("display_name")}
        error={errors.display_name?.message}
      />
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
        autoComplete="new-password"
        {...register("password")}
        error={errors.password?.message}
      />
      <TextField
        label="Nhập lại mật khẩu"
        type="password"
        autoComplete="new-password"
        {...register("confirm")}
        error={errors.confirm?.message}
      />

      <Button type="submit" className="w-full" disabled={signUp.isPending}>
        {signUp.isPending ? "Đang tạo tài khoản…" : "Đăng ký"}
      </Button>

      <p className="text-center text-sm">
        Đã có tài khoản?{" "}
        <Link
          to="/login"
          className="font-semibold text-green-700 hover:underline"
        >
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
