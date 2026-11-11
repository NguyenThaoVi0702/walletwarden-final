// Route config (not a component module), so fast refresh does not apply.
/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from "react";
import type { RouteObject } from "react-router-dom";
import { GuestOnly, RequireAuth } from "./auth/RequireAuth";
import { Spinner } from "./components/Spinner";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";

// One chunk per page keeps the first load light on phones.
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Categories = lazy(() => import("./pages/Categories"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Advisor = lazy(() => import("./pages/Advisor"));
const Report = lazy(() => import("./pages/Report"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const page = (node: ReactNode) => (
  <Suspense fallback={<Spinner />}>{node}</Suspense>
);

export const routes: RouteObject[] = [
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "/login", element: page(<Login />) },
          { path: "/register", element: page(<Register />) },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: page(<Dashboard />) },
          { path: "/transactions", element: page(<Transactions />) },
          { path: "/categories", element: page(<Categories />) },
          { path: "/budgets", element: page(<Budgets />) },
          { path: "/advisor", element: page(<Advisor />) },
          { path: "/report", element: page(<Report />) },
          { path: "/settings", element: page(<Settings />) },
          { path: "*", element: page(<NotFound />) },
        ],
      },
    ],
  },
];
