import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "./components/layout/AppShell.jsx";
import { AuthLayout } from "./components/layout/AuthLayout.jsx";
import { GuestOnly, RequireAuth } from "./components/layout/RouteGuards.jsx";
import { PageLoader } from "./components/ui/Loading.jsx";
import { ROLES } from "./utils/constants.js";

// Pages are code-split: visitors only download the screens they use
// (the administrator dashboard, with its charts, is not sent to citizens).
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));
const MyRequestsPage = lazy(() => import("./pages/citizen/MyRequestsPage.jsx"));
const NewRequestPage = lazy(() => import("./pages/citizen/NewRequestPage.jsx"));
const RequestDetailPage = lazy(() => import("./pages/shared/RequestDetailPage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage.jsx"));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Sign in / register: their own split-screen layout, without the app header and footer. */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        </Route>

        <Route element={<AppShell />}>
          <Route index element={<LandingPage />} />

          <Route path="requests" element={<RequireAuth role={ROLES.CITIZEN}><MyRequestsPage /></RequireAuth>} />
          <Route path="requests/new" element={<RequireAuth role={ROLES.CITIZEN}><NewRequestPage /></RequireAuth>} />
          <Route path="requests/:reference" element={<RequireAuth><RequestDetailPage /></RequireAuth>} />

          <Route path="admin" element={<RequireAuth role={ROLES.ADMIN}><AdminDashboardPage /></RequireAuth>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
