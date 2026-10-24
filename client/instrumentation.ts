import { registerOTel } from '@vercel/otel';
import { trace, type Attributes, type Context, type Link, type SpanKind } from '@opentelemetry/api';

const TRACE_FLAG_SAMPLED = 1;
const DROP = 0;
const RECORD_AND_SAMPLE = 2;

const HEALTH_AND_STATIC_PATHS = ['/healthz', '/health', '/metrics', '/favicon.ico', '/robots.txt'];

const customSampler = {
  shouldSample(context: Context, traceId: string, name: string, spanKind: SpanKind, attributes: Attributes, _links: Link[]) {
    const parentSpanContext = trace.getSpanContext(context);
    if (parentSpanContext) {
      const parentIsSampled = (parentSpanContext.traceFlags & TRACE_FLAG_SAMPLED) !== 0;
      return { decision: parentIsSampled ? RECORD_AND_SAMPLE : DROP };
    }

    const target = (attributes?.['http.target'] || attributes?.['http.url'] || '').toString();
    const isHealthOrStaticRequest = HEALTH_AND_STATIC_PATHS.some((path) => name.includes(path) || target.includes(path));

    return { decision: isHealthOrStaticRequest ? DROP : RECORD_AND_SAMPLE };
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
