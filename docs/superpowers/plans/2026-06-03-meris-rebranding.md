# Meris Rebranding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the application from "SplitBill" to "Meris" across all UI components and metadata, and add a "Philosophy" section to the landing page.

**Architecture:** Systematic replacement of branding strings, updating typography constants for the new logo style, and implementing a new content section on the home page.

**Tech Stack:** Next.js (App Router), Tailwind CSS, Framer Motion.

---

### Task 1: Global Metadata and Layout Rebranding

**Files:**
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Update Metadata in layout.tsx**

```typescript
// frontend/src/app/layout.tsx
export const metadata: Metadata = {
  title: "Meris | Share the moment, split the cost",
  description: "Approachable and proportional expense sharing with AI-powered receipt extraction.",
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "chore: update metadata for Meris rebranding"
```

---

### Task 2: Home Page Branding and "About" Section

**Files:**
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Update Logo and Headline**

Replace the old "SplitBill AI" or text-based logo references with the new dual-font "Meris" style.

```tsx
// frontend/src/app/page.tsx
// Update footer branding
<footer className="mt-auto py-8 text-center relative z-10">
  <p className="text-[10px] text-foreground/10 uppercase tracking-[0.5em] font-bold">
    Meris &copy; 2026
  </p>
</footer>
```

- [ ] **Step 2: Add "The Philosophy of Meris" Section**

Insert the new section between the main card and the footer.

```tsx
// frontend/src/app/page.tsx
{/* Philosophy Section */}
<motion.section 
  variants={itemVariants}
  className="mt-24 mb-16 max-w-3xl mx-auto px-6 text-center space-y-8"
>
  <h2 className="text-xl sm:text-2xl font-serif text-foreground/80 tracking-tight">The Philosophy of Meris</h2>
  <div className="glass-panel rounded-glass p-8 sm:p-12 border-white/5 bg-white/[0.01] relative overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-linear-to-b from-sage/40 to-transparent" />
    <p className="font-serif italic text-lg sm:text-xl text-foreground/50 leading-relaxed">
      &ldquo;Derived from the Ancient Greek word &mu;&tilde;&epsilon;&rho;&iota;&sigmaf; (M&eacute;ris), meaning &apos;portion&apos; or &apos;part&apos;. We believe that every shared moment shouldn&apos;t be burdened by the complexity of numbers. Meris is built to ensure every portion is accounted for with absolute fairness, allowing you to focus on the experience, not the expense.&rdquo;
    </p>
  </div>
</motion.section>
```

- [ ] **Step 3: Update Join Button and Input**

```tsx
// frontend/src/app/page.tsx
<p className="text-[10px] sm:text-xs text-foreground/15 uppercase tracking-[0.2em] sm:tracking-[0.4em] font-bold">
  Meris Protocol // Simplicity in every byte
</p>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: implement Meris branding and Philosophy section on home page"
```

---

### Task 3: Session Page Branding Update

**Files:**
- Modify: `frontend/src/app/session/[id]/page.tsx`

- [ ] **Step 1: Update Header Branding**

```tsx
// frontend/src/app/session/[id]/page.tsx
<h1 className="text-3xl sm:text-5xl md:text-7xl font-serif text-foreground tracking-tight leading-tight">
  Reviewing the <span className="text-sage font-sans font-light">Meris</span>
</h1>
```

- [ ] **Step 2: Update Footer**

```tsx
// frontend/src/app/session/[id]/page.tsx
<footer className="mt-24 py-12 border-t border-white/5 opacity-40">
  <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40">
    <p>Meris &copy; 2026</p>
    <p className="font-mono tracking-normal opacity-50 uppercase">Session: {sessionId}</p>
  </div>
</footer>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/session/[id]/page.tsx
git commit -m "chore: rebrand session page to Meris"
```

---

### Task 4: Final Consistency Check

- [ ] **Step 1: Grep for any remaining "SplitBill" occurrences**

Run: `grep -r "SplitBill" frontend/src`
Expected: No matches in user-facing UI.

- [ ] **Step 2: Commit any cleanups**

```bash
git commit -m "chore: finalize Meris rebranding consistency"
```
