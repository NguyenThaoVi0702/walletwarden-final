# Frontend: hướng dẫn cho Tùng

> Chủ: **Tùng** (Frontend, UI/UX) · Người review PR của bạn: **Vi** · Bạn review PR của: **Khải**

Bạn sở hữu toàn bộ `frontend/`. Stack theo plan §4.2: React 18 + TypeScript (strict) + Vite, Tailwind CSS, React Router, TanStack Query, Recharts, React Hook Form + Zod, vite-plugin-pwa, MSW.

## 1. Việc của bạn theo plan

| Task | Hạn | Kết quả |
|---|---|---|
| T03 Slide kế hoạch + logo | 26/10 | |
| T07 Khảo sát ≥ 30 người nhiều độ tuổi, nghề | 30/10 | kết quả vào `Documents/` |
| T08 Wireframe + UI kit desktop và điện thoại | 30/10 | Figma (link trong `Documents/README.md`) |
| **T13 App shell, routing, layout responsive, PWA, MSW mock từ OpenAPI** | **2/11** | khởi tạo theo mục 2 |
| T14 F2, F3 màn hình giao dịch + danh mục | 5/11 | |
| T15 F4, F5 ngân sách + dashboard | 8/11 | |
| T16 F6, F7 chat AI + roast alert (trên mock) | 10/11 | |
| T30 UAT với 5 người | 14/11 | `tests/uat/` |

## 2. Khởi tạo project (T13, làm một lần)

```powershell
cd frontend
npm create vite@latest . -- --template react-ts      # chọn "Ignore files and continue" (giữ README này)
npm install
npm install react-router-dom @tanstack/react-query recharts react-hook-form zod @hookform/resolvers openapi-fetch
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa msw openapi-typescript `
  vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event `
  prettier eslint-config-prettier
npx msw init public --save
```

### Script bắt buộc trong `package.json` (CI gọi đúng các tên này)

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "lint": "eslint . && prettier --check \"src/**/*.{ts,tsx,css}\"",
  "format": "prettier --write \"src/**/*.{ts,tsx,css}\"",
  "typecheck": "tsc -b --pretty",
  "test": "vitest",
  "gen:api": "openapi-typescript ../backend/openapi.json -o src/api/schema.d.ts"
}
```

Commit cả `package-lock.json` (CI dùng `npm ci`). Thêm `src/api/schema.d.ts` vào `.prettierignore` và `.eslintignore`/`ignores` vì là file sinh tự động.

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WalletWarden', short_name: 'WalletWarden', lang: 'vi',
        theme_color: '#0F2A4A', background_color: '#FFFFFF', display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],   // quan trọng: SW không được trả index.html cho API
        runtimeCaching: [{ urlPattern: /^\/api\//, handler: 'NetworkOnly' }],
      },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:8000' } },   // dev: gọi backend thật khi tắt mock
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
});
```

## 3. Cấu trúc gợi ý

```
src/
  api/
    schema.d.ts        SINH TỰ ĐỘNG từ backend/openapi.json (npm run gen:api), không sửa tay
    client.ts          openapi-fetch + gắn JWT + xử lý 401 (về trang đăng nhập) và 429 (AI bận)
    hooks/             useTransactions(), useBudgets(), useChat()... (TanStack Query)
  mocks/
    handlers.ts        MSW: trả dữ liệu mẫu ĐÚNG type trong schema.d.ts
    browser.ts         setupWorker(...handlers)
    data.ts            dữ liệu mẫu 1 tháng (dùng lại cho test)
  layouts/AppLayout.tsx  sidebar (≥ 768px) / bottom nav (< 768px)
  pages/               Login, Register, Dashboard, Transactions, Categories, Budgets, Advisor, Report, Settings
  components/          BudgetProgress, CategoryPicker, RoastToast, MoneyInput, ...
  lib/format.ts        formatVND(1500000) → "1.500.000 ₫"
  test/setup.ts
```

### Client gọi API (type an toàn tuyệt đối từ contract)

```ts
// src/api/client.ts
import createClient from 'openapi-fetch';
import type { paths } from './schema';

export const api = createClient<paths>({ baseUrl: '/' });
api.use({
  onRequest({ request }) {
    const token = localStorage.getItem('ww_token');
    if (token) request.headers.set('Authorization', `Bearer ${token}`);
    return request;
  },
});
// dùng: const { data, error } = await api.GET('/api/transactions', { params: { query: { month } } });
```

Đổi tên field trong backend → `npm run gen:api` → TypeScript báo lỗi đúng chỗ cần sửa. Đây là cách 3 track không lệch nhau.

### Bật/tắt mock

```ts
// src/main.tsx
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
enableMocking().then(() => createRoot(document.getElementById('root')!).render(<App />));
```

- `frontend/.env.development`: `VITE_USE_MOCKS=true` (31/10–9/11 làm việc không cần backend).
- Build production (demo) **không** bật mock.
- Trial 6/11 / tích hợp 10/11: `VITE_USE_MOCKS=false` + backend chạy ở :8000 (xem [INTEGRATION.md §3](../INTEGRATION.md)).

## 4. Yêu cầu UI quan trọng

**Responsive (plan §8.4):** mobile-first, kiểm tra ở **375 px, 768 px, 1440 px**. Desktop: sidebar + dashboard rộng; điện thoại: bottom navigation + thẻ xếp chồng. Mọi PR thay đổi UI đính kèm ảnh 375 px và 1440 px.

**Tiền:** số nguyên VND, hiển thị `1.500.000 ₫`; ô nhập cho phép gõ `45k`, `1tr2` thì tốt.

**Màn hình AI (F6–F9)**, type lấy từ `schema.d.ts` (`AIReply`, `MonthlyReport`, `ParsedEntry`, `RoastAlert`):

- Chat: gửi `{question, history}` (tối đa 6 lượt gần nhất); hiển thị trạng thái "đang nghĩ…" (model local có thể mất 1–5 s); `AIReply.fallback === true` → hiện nhãn nhỏ "chế độ dự phòng".
- **Disclaimer cố định** trong màn hình chat: "WalletWarden chỉ đưa ra gợi ý chung về chi tiêu, không phải tư vấn tài chính chuyên nghiệp."
- HTTP 429 → "Bạn hỏi hơi nhanh, thử lại sau X giây" (header `Retry-After`).
- Roast: sau khi tạo giao dịch, nếu response có `roast_pending: true` → poll `GET /api/ai/alerts?unread=true` mỗi 2 s (tối đa 15 s) → hiện toast/alert theo giọng (màu khác nhau cho Gentle/Honest/Savage) → gọi `/read` khi đóng; nút **"Báo cáo tin nhắn này"** gọi `/report` (rủi ro R6).
- Cài đặt: bật/tắt Roast Mode (mặc định **tắt**, opt-in) và chọn giọng.
- Nhập nhanh (F9, làm sau M3): ô "trà sữa 45k" → `POST /api/ai/parse` → điền sẵn form để người dùng xác nhận, **không lưu tự động**.

## 5. Test và CI

```powershell
npm run gen:api; npm run lint; npm run typecheck; npm test -- --run; npm run build
```

- Vitest + React Testing Library, dùng lại MSW (`msw/node`) trong test.
- Tối thiểu: form thêm giao dịch (validate Zod), `BudgetProgress` (0%, 80%, >100%), `formatVND`, trang đăng nhập (lỗi 401).
- CI job `frontend` chạy đúng chuỗi lệnh trên; nó cũng kiểm tra `schema.d.ts` khớp `openapi.json`.

## 6. Ngày tích hợp

Checklist ở [INTEGRATION.md §4](../INTEGRATION.md). Trước 10/11: mọi màn hình chạy được với mock **và** không còn `any` ở chỗ gọi API.
