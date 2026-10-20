import { registerOTel } from '@vercel/otel';
import { trace, type Attributes, type Context, type Link, type SpanKind } from '@opentelemetry/api';

const customSampler = {
  shouldSample(context: Context, traceId: string, name: string, spanKind: SpanKind, attributes: Attributes, _links: Link[]) {
    // 1. Check parent span context (ParentBased sampler behavior)
    const parentSpanContext = trace.getSpanContext(context);
    if (parentSpanContext) {
      const isSampled = (parentSpanContext.traceFlags & 1) !== 0;
      return { decision: isSampled ? 2 : 0 };
    }

    // 2. Root span filtering (exclude system/health check paths)
    const target = (attributes?.['http.target'] || attributes?.['http.url'] || '').toString();
    const isExcluded =
      name.includes('/healthz') ||
      name.includes('/health') ||
      name.includes('/metrics') ||
      name.includes('/favicon.ico') ||
      name.includes('/robots.txt') ||
      target.includes('/healthz') ||
      target.includes('/health') ||
      target.includes('/metrics') ||
      target.includes('/favicon.ico') ||
      target.includes('/robots.txt');

    if (isExcluded) {
      return { decision: 0 };
    }

    // 3. Fallback: Always sample normal business and API transactions
    return { decision: 2 };
  },
  toString() {
    return 'CustomHomelabSampler';
  },
};

export function register() {
  registerOTel({
    serviceName: 'meris-client',
    traceSampler: customSampler,
  });
}
