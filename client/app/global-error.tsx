"use client";

import { useEffect, useState } from "react";
import { detectBrowserLocale, getMessages } from "@/shared/i18n";
import { ErrorScreen } from "@/shared/ui/ErrorScreen";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const [locale] = useState(detectBrowserLocale);
  const m = getMessages(locale);

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="bg-background text-foreground antialiased">
        <title>{m.meta.errorTitle}</title>
        <ErrorScreen
          eyebrow={m.globalError.eyebrow}
          title={m.globalError.title}
          body={m.globalError.body}
          retryLabel={m.common.retry}
          onRetry={unstable_retry}
          homeLabel={m.common.backHome}
        />
      </body>
    </html>
  );
}
