# Frontend

Progressive web app built with React, TypeScript, Vite and Tailwind CSS. Data fetching uses TanStack Query, forms use React Hook Form with Zod, and charts use Recharts.

## Run

```powershell
cd frontend
npm ci
npm run dev        # http://localhost:5173
```

By default the dev server uses mock data (MSW), so no backend is needed. Sign in with `demo@walletwarden.vn` / `matkhau123`.

To talk to a real backend on port 8000:

```powershell
$env:VITE_USE_MOCKS="false"; npm run dev      # macOS/Linux: VITE_USE_MOCKS=false npm run dev
```

## Build

```powershell
npm run build      # outputs frontend/dist
```

The backend serves `frontend/dist`, so after building, <http://localhost:8000> shows the app.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build` | type-check and production build (includes the service worker) |
| `npm test` | unit and component tests (Vitest, Testing Library, MSW) |
| `npm run lint` | ESLint and Prettier check |
| `npm run format` | format the source |
| `npm run typecheck` | TypeScript only |
| `npm run gen:api` | regenerate `src/api/schema.d.ts` from `../backend/openapi.json` |

## Structure

```
src/
  api/        typed API client, hooks and generated schema
  auth/       sign-in state and route guards
  components/ shared UI: modal, charts, budget progress, form fields
  layouts/    app shell (sidebar on desktop, bottom navigation on phones)
  lib/        formatting, money parsing, category colors and icons
  mocks/      MSW handlers and sample data
  pages/      one file per screen
  roast/      roast alert polling and toast
```

## API types

`src/api/schema.d.ts` is generated from the backend's OpenAPI file. After the backend API changes, run `npm run gen:api`; TypeScript then points to every place that needs updating.

## Design

Colors and logo are documented in [assets/brand/README.md](../assets/brand/README.md). The layout is responsive: sidebar from 768 px, bottom navigation below. Status is never conveyed by color alone.
