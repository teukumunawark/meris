import React, { forwardRef } from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input 
        ref={ref}
        className={`rounded-glass-sm text-foreground placeholder:text-foreground/35 focus:border-sage/40 border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-3 font-sans text-base transition-colors focus:outline-none sm:text-sm ${className}`} 
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
