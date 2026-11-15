import { useContext } from "react";
import { ThemeContext } from "../app/providers/themeContext.js";
import type { ThemeContextValue } from "../types/theme.js";

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
