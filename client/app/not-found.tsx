import Link from "next/link";
import { getMessages } from "@/shared/i18n";
import { getRequestLocale } from "@/shared/i18n/server";

export default async function NotFound() {
  const m = getMessages(await getRequestLocale());

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel rounded-glass w-full max-w-xl border-[var(--glass-border)] bg-[var(--glass-bg)] p-8 sm:p-10">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="font-mono text-sm font-medium tracking-[0.24em] uppercase opacity-40">
              404
            </p>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">
              {m.notFound.title}
            </h1>
            <p className="font-sans text-sm leading-6 opacity-60">
              {m.notFound.body}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link 
              href="/" 
              className="rounded-glass-sm bg-sage text-background cursor-pointer px-5 py-2.5 font-sans text-xs font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
            >
              {m.common.backHome}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
