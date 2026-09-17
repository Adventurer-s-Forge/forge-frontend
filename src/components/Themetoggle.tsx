import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "../theme/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
      {theme === 'dark' ? <FiSun size={17} /> : <FiMoon size={17} />}
    </button>
  )
}