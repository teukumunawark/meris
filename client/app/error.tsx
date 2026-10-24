"use client";

import { useEffect } from "react";
import { useI18n } from "@/shared/i18n";
import { ErrorScreen } from "@/shared/ui/ErrorScreen";

export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { m } = useI18n();

  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <ErrorScreen
      eyebrow={m.globalError.eyebrow}
      title={m.globalError.title}
      body={m.globalError.body}
      retryLabel={m.common.retry}
      onRetry={unstable_retry}
      homeLabel={m.common.backHome}
    />
  );
}
