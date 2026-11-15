import { Outlet } from "react-router-dom";

export function RootLayout() {
  return (
    <div id="app-root">
      <Outlet />
    </div>
  );
}
