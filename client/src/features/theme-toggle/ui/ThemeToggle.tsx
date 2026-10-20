"use client";

import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useMounted } from "@/shared/hooks";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-9 w-9" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-foreground/60 hover:text-foreground relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] transition-all duration-300 hover:bg-[var(--glass-highlight)] focus:outline-none active:scale-95"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.svg
            key="sun"
            className="h-4.5 w-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </motion.svg>
        ) : (
          <motion.svg
            key="moon"
            className="h-4.5 w-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </motion.svg>
        )}
      </AnimatePresence>
    </button>
  );
}
