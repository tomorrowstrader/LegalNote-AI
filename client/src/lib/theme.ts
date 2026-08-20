/** Keep document theme, color-scheme, and browser chrome (status bar) in sync. */

export type AppTheme = "light" | "dark";

const LIGHT_THEME_COLOR = "#faf7f2";
const DARK_THEME_COLOR = "#0b1220";

export function getStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("theme");
  return saved === "dark" ? "dark" : "light";
}

export function applyTheme(theme: AppTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  localStorage.setItem("theme", theme);

  const color = theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => meta.setAttribute("content", color));
}
