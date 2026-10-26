import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

/** Arranca trazas solo si hay un colector configurado. Un colector caído no detiene el proceso. */
export const startTelemetry = (serviceName: string): void => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!endpoint || sdk) return;
  const url = endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1/traces`;
  sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url }),
    instrumentations: [new HttpInstrumentation()],
  });
  sdk.start();
};

export const shutdownTelemetry = async (): Promise<void> => {
  await sdk?.shutdown();
  sdk = undefined;
};
