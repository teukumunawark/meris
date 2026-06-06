import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({ children, className = "", variant = "primary", size = "md", ...props }: ButtonProps) {
  const baseStyles = "rounded-glass-sm font-sans font-bold tracking-wider uppercase transition-all active:scale-[0.98] cursor-pointer disabled:opacity-10";
  
  const variantStyles = {
    primary: "text-background bg-sage hover:brightness-110",
    ghost: "text-foreground/60 border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-highlight)] hover:text-foreground",
    danger: "text-rose-600 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/25 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-[9px]",
    md: "px-5 py-2.5 text-xs",
    lg: "px-8 py-4 text-sm",
  };

  return (
    <button 
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
}
