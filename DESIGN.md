# Meris design direction

Drawn from what the client already ships (`client/app/globals.css`, `client/app/layout.tsx`, the landing page). Edit freely; this file is the source of direction for UI work.

## Identity
- Product: split a restaurant receipt between friends without accounts. Indonesian audience, used on phones at the table.
- Language: Indonesian UI copy, informal "kamu".

## Palette
- Core: sage (`--primary-sage`, `#4a5d4e` light / `#8ba895` dark) on a neutral background (`#f7f8f6` light / `#111418` dark).
- Accent use: sage marks the one thing that belongs to the viewer (their amount, their flows, the primary action). Everything else stays neutral.
- Status colors only where they carry meaning: green = receives money, red = pays money, rose = destructive action.

## Typography
- Fraunces (serif) for headings and the money that matters (the viewer's transfer, the receipt total).
- Plus Jakarta Sans for everything else, numbers in `tabular-nums`.
- Normal-case labels; no wide-tracked uppercase.

## Theme
- Light and dark both ship (`next-themes`, default dark). Both must pass WCAG AA.

## Motif
- Receipt: dashed rules between money rows, right-aligned tabular amounts.

## Dial
ENERGY 2 / RHYTHM 2 / MOTION 1
