import { useEffect, useRef, useState } from "react";

/**
 * Captcha widget (Audit Fix #2 / P0).
 *
 * Renders either hCaptcha or Cloudflare Turnstile based on which site key
 * is configured in `VITE_CAPTCHA_SITE_KEY` + `VITE_CAPTCHA_PROVIDER`.
 *
 * Usage:
 *   <Captcha onVerify={setCaptchaToken} />
 *
 * The token is then sent to the backend edge function which verifies it
 * server-side with the secret key.
 */

declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
    onCaptchaLoad?: () => void;
  }
}

interface CaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

const PROVIDER = import.meta.env.VITE_CAPTCHA_PROVIDER as "hcaptcha" | "turnstile" | undefined;
const SITE_KEY = import.meta.env.VITE_CAPTCHA_SITE_KEY as string | undefined;

let scriptLoaded = false;
let scriptPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Captcha({ onVerify, onExpire, onError, className }: CaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackName = useRef(`_captchaCb_${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!SITE_KEY || !PROVIDER) {
      setError("Captcha non configuré (VITE_CAPTCHA_SITE_KEY manquant)");
      return;
    }

    // Expose callbacks globally (captcha SDKs need window refs).
    (window as Record<string, unknown>)[`${callbackName}_verify`] = onVerify;
    (window as Record<string, unknown>)[`${callbackName}_expire`] = onExpire ?? (() => {});
    (window as Record<string, unknown>)[`${callbackName}_error`] = () => {
      onError?.();
      setError("Erreur captcha");
    };

    const scriptUrl =
      PROVIDER === "hcaptcha"
        ? "https://js.hcaptcha.com/1/api.js?render=explicit&recaptchacompat=off"
        : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

    loadScript(scriptUrl)
      .then(() => {
        if (!containerRef.current) return;
        const sdk = PROVIDER === "hcaptcha" ? window.hcaptcha : window.turnstile;
        if (!sdk) return;

        widgetIdRef.current = sdk.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => onVerify(token),
          "expired-callback": onExpire,
          "error-callback": () => {
            onError?.();
            setError("Erreur captcha");
          },
        });
      })
      .catch((e) => setError(String(e)));

    return () => {
      // Cleanup is best-effort; SDKs don't expose unmount.
      widgetIdRef.current = null;
    };
  }, [onVerify, onExpire, onError, callbackName]);

  if (error) {
    return (
      <div className={`text-sm text-destructive ${className ?? ""}`} role="alert">
        {error}
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-label="Verification captcha" />;
}

export default Captcha;
