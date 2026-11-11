import { Outlet } from "react-router-dom";

/** Sign-in and register layout: navy background on phones, split screen on desktop. */
export function AuthLayout() {
  return (
    <div className="grid min-h-svh md:grid-cols-2">
      <section className="flex flex-col items-center justify-center gap-4 bg-navy px-6 py-10 text-center text-white">
        <img
          src="/logo-192.png"
          alt="WalletWarden logo"
          width={96}
          height={96}
          className="md:size-32"
        />
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          WalletWarden
        </h1>
        <p className="text-green">Spend less. Or get roasted.</p>
        <p className="hidden max-w-sm text-sm text-white/70 md:block">
          Ghi thu chi, đặt ngân sách, hỏi trợ lý AI — và bị AI "roast" mỗi khi
          tiêu quá tay.
        </p>
      </section>
      <section className="flex items-start justify-center bg-white px-4 py-8 md:items-center">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
