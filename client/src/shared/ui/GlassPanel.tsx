import React from "react";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "solid" | "light";
}

export function GlassPanel({ children, className = "", variant = "light", ...props }: GlassPanelProps) {
  const baseStyles = "glass-panel rounded-glass relative overflow-hidden border-[var(--glass-border)] transition-all duration-300 shadow-xs";
  const variantStyles = variant === "light" ? "bg-[var(--glass-bg)]" : "bg-[var(--glass-bg-solid)]";
  
  return (
    <div className={`${baseStyles} ${variantStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}
