import React from "react";
import { ThemeProvider } from "./ThemeProvider.js";
import { QueryProvider } from "./QueryProvider.js";

export interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        {children}
      </QueryProvider>
    </ThemeProvider>
  );
}
