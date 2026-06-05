# Design Spec: Rebranding to "Meris" & About Section Implementation

**Date:** 2026-06-03
**Status:** Draft
**Topic:** Rebranding from "SplitBill" to "Meris" and adding a philosophy-driven "About" section.

## 1. Vision & Identity
The application is evolving from a functional utility ("SplitBill") to a refined financial experience named **Meris**. 
- **Etymology:** *Meris* (Greek: μέρις) means "portion" or "part".
- **Tone:** Intellectual, minimalist, altruistic, and high-precision.
- **Goal:** To remove the friction of shared expenses through a "Financial Layer" that feels quiet and helpful.

## 2. Branding Updates
### 2.1 Logo & Typography
- **Primary Text:** `Meris`
- **Styling:** 
  - `Me`: Serif (Fraunces) - Representing heritage and stability.
  - `ris`: Sans (Plus Jakarta Sans) - Representing modern precision and fluidity.
- **Tagline:** *"Share the moment, split the cost."* (Unchanged, as it aligns perfectly with the new name).

### 2.2 Global References
- Update `title` and `description` in `layout.tsx` (Metadata).
- Update all occurrences of "SplitBill" in `page.tsx` (Home and Session) and `ParticipantBreakdown.tsx`.
- Update Footer branding from `SplitBill &copy; 2026` to `Meris &copy; 2026`.

## 3. UI Implementation: "The Philosophy of Meris"
### 3.1 Content
**Title:** `The Philosophy of Meris`
**Body:** 
> *Derived from the Ancient Greek word μ῀ερις (Méris), meaning 'portion' or 'part'. We believe that every shared moment shouldn't be burdened by the complexity of numbers. Meris is built to ensure every portion is accounted for with absolute fairness, allowing you to focus on the experience, not the expense.*

### 3.2 Placement
- **Home Page (`page.tsx`):** A new `glass-panel` section placed between the main "Start a Session" card and the Footer.
- **Styling:** Minimalist, centered text, utilizing `font-serif` for the quote to maintain an editorial feel.

## 4. Technical Changes
- **File Updates:**
  - `frontend/src/app/layout.tsx`: Metadata updates.
  - `frontend/src/app/page.tsx`: Rebranding header, "About" section insertion, and footer update.
  - `frontend/src/app/session/[id]/page.tsx`: Header and footer rebranding.
  - `frontend/src/app/session/[id]/ParticipantBreakdown.tsx`: Any internal text references.
- **Consistency Check:** Ensure `alt` tags and `aria-labels` are updated to reflect the new name.

## 5. Success Criteria
- The name "SplitBill" is completely removed from the user-facing UI.
- The "About" section is visually integrated without cluttering the landing page.
- The typography of the new logo (`Me`serif/`ris`sans) is correctly rendered.
