"use client";

import { useEffect } from "react";
import { useI18n } from "@/shared/i18n";
import { ErrorScreen } from "@/shared/ui/ErrorScreen";

export default function SessionRouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { m } = useI18n();

  useEffect(() => {
    console.error("Session route error:", error);
  }, [error]);

  return (
    <ErrorScreen
      title={m.sessionPage.boundaryTitle}
      body={m.sessionPage.boundaryBody}
      retryLabel={m.common.retry}
      onRetry={unstable_retry}
      homeLabel={m.common.backHome}
    />
  );
}
