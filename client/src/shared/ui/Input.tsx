import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input 
      className={`rounded-glass-sm text-foreground placeholder:text-foreground/35 focus:border-sage/40 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 font-sans text-sm transition-colors focus:outline-none ${className}`} 
      {...props}
    />
  );
}
