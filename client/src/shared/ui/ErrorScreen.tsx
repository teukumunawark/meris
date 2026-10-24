import Link from "next/link";

interface ErrorScreenProps {
  eyebrow?: string;
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
  homeLabel: string;
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage";

export function ErrorScreen({ eyebrow, title, body, retryLabel, onRetry, homeLabel }: ErrorScreenProps) {
  return (
    <main role="alert" className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel rounded-glass w-full max-w-xl border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 sm:p-10">
        {eyebrow && (
          <p className="text-foreground/65 font-sans text-sm font-medium">{eyebrow}</p>
        )}
        <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-foreground/75 mt-3 font-sans text-sm leading-6">{body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className={`rounded-glass-sm bg-sage text-background min-h-11 cursor-pointer px-5 font-sans text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98] ${focusRing}`}
          >
            {retryLabel}
          </button>
          <Link
            href="/"
            className={`rounded-glass-sm text-foreground flex min-h-11 cursor-pointer items-center justify-center border border-[var(--glass-border)] bg-[var(--glass-bg)] px-5 font-sans text-sm font-semibold transition-colors hover:bg-[var(--glass-highlight)] active:scale-[0.98] ${focusRing}`}
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
