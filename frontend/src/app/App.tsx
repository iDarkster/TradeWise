import { RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers/index.js";
import { router } from "./router/index.js";

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
