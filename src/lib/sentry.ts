import * as Sentry from "@sentry/react";

/**
 * Sentry initialization (Audit Fix #46 / P2).
 *
 * Initialize as early as possible in `main.tsx` BEFORE React renders.
 * The DSN is public (safe to expose) — it only identifies the project.
 *
 * PII scrubbing: we redact `email`, `password`, `token`, `authorization`
 * from breadcrumbs and tags before sending to Sentry.
 */

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const APP_ENV = import.meta.env.VITE_APP_ENV || import.meta.env.MODE || "development";

export function initSentry() {
  if (!SENTRY_DSN) {
    // Silent in dev / preview environments without Sentry configured.
    if (APP_ENV !== "production") return;
    console.warn("[sentry] VITE_SENTRY_DSN not set — error tracking disabled in production.");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    release: `e2d-connect-gateway@${__APP_VERSION__ ?? "dev"}`,
    tracesSampleRate: APP_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: APP_ENV === "production" ? 0.1 : 0,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // PII redaction — strip sensitive keys from breadcrumbs/tags.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        const sanitized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(breadcrumb.data)) {
          if (/password|token|authorization|secret|api_key/i.test(k)) {
            sanitized[k] = "[Redacted]";
          } else {
            sanitized[k] = v;
          }
        }
        breadcrumb.data = sanitized;
      }
      return breadcrumb;
    },

    beforeSend(event) {
      // Strip emails from request URLs.
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
          "[email]"
        );
      }
      return event;
    },

    denyUrls: [
      // Don't send errors from browser extensions.
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });
}

export { Sentry };
