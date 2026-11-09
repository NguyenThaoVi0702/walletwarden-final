import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[60svh] place-items-center text-center">
      <div>
        <p className="text-5xl font-bold text-green-700">404</p>
        <p className="mt-2 text-navy/70">Không tìm thấy trang này.</p>
        <Link
          to="/"
          className="mt-4 inline-block font-semibold text-green-700 hover:underline"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
