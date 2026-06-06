# ADR 0001: Dark/Light Theme Implementation

## Status
Accepted

## Context
The Meris client currently defaults to a dark aesthetic (slate-charcoal background, light text) hardcoded in CSS. The user requested adding a dark/light mode toggle to support high-ambient-light environments. 

We needed a solution that:
1. Prevents initial layout color flash (hydration mismatch or visual flash before JavaScript loads).
2. Works seamlessly with Tailwind CSS v4's CSS-first theme configuration.
3. Minimizes complex configuration overhead.

## Decision
We chose to use the `next-themes` package to manage theme selection and storage, combined with Tailwind CSS v4's `@custom-variant dark` class-based dark mode selector.

Specifically:
- We use the Next.js `ThemeProvider` from `next-themes` with `attribute="class"` to inject the `.dark` class dynamically.
- In `globals.css`, we map our theme variables under `:root` (for Light Mode) and `.dark` (for Dark Mode).
- We map Tailwind `@theme` utilities to point to dynamic CSS variables (`var(--background)`, `var(--foreground)`, etc.) rather than hardcoded colors, ensuring that standard Tailwind utility classes automatically react to theme changes.
- The toggle button will be built with Framer Motion for premium-feeling transitions between the Sun and Moon icons.

## Consequences
- **Pros**:
  - Out-of-the-box support for OS-level preferences and session storage.
  - Zero layout flash due to next-themes' inline script in Next.js layout head.
  - Keeps styling clean by leveraging native CSS variables that adapt dynamically.
- **Cons**:
  - Introduces a small dependency (`next-themes`) to the client workspace.
