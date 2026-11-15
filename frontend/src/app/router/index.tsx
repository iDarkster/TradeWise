import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../../components/navigation/AppShell.js";
import {
  ProtectedRoute,
  AdminRoute,
  PublicOnlyRoute,
} from "../../components/navigation/RouteGuards.js";
import { BootstrapPage } from "../../features/explore/pages/BootstrapPage.js";
import { LoginPage } from "../../features/auth/pages/LoginPage.js";
import { RegisterPage } from "../../features/auth/pages/RegisterPage.js";
import { SettingsLayout } from "../../features/settings/layouts/SettingsLayout.js";
import { BasicDetailsPage } from "../../features/settings/pages/BasicDetailsPage.js";
import { ChangePasswordPage } from "../../features/settings/pages/ChangePasswordPage.js";
import { ActiveSessionsPage } from "../../features/settings/pages/ActiveSessionsPage.js";
import { AdminLayout } from "../../features/admin/layouts/AdminLayout.js";
import { AdminUsersPage } from "../../features/admin/pages/AdminUsersPage.js";
import { AdminUserDetailPage } from "../../features/admin/pages/AdminUserDetailPage.js";
import { AdminAuditLogsPage } from "../../features/admin/pages/AdminAuditLogsPage.js";
import { NotFoundView } from "../../components/feedback/NotFoundView.js";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <BootstrapPage />,
      },
      // Public-only authentication routes (redirect away if already logged in)
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: "login",
            element: <LoginPage />,
          },
          {
            path: "register",
            element: <RegisterPage />,
          },
        ],
      },
      // Protected user routes
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "settings",
            element: <SettingsLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="basic-details" replace />,
              },
              {
                path: "basic-details",
                element: <BasicDetailsPage />,
              },
              {
                path: "change-password",
                element: <ChangePasswordPage />,
              },
              {
                path: "sessions",
                element: <ActiveSessionsPage />,
              },
            ],
          },
        ],
      },
      // Admin-only routes
      {
        element: <AdminRoute />,
        children: [
          {
            path: "admin",
            element: <AdminLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="users" replace />,
              },
              {
                path: "users",
                element: <AdminUsersPage />,
              },
              {
                path: "users/:id",
                element: <AdminUserDetailPage />,
              },
              {
                path: "audit-logs",
                element: <AdminAuditLogsPage />,
              },
            ],
          },
        ],
      },
      // 404 Catch-All
      {
        path: "*",
        element: <NotFoundView />,
      },
    ],
  },
]);
