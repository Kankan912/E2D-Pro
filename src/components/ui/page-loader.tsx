import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  /** Full page loader with min-height screen */
  fullPage?: boolean;
  /** Custom message to display */
  message?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable loading component for Suspense fallbacks and loading states.
 * 
 * Usage:
 * - Full page: <PageLoader fullPage /> or <PageLoader fullPage message="Loading dashboard..." />
 * - Inline/section: <PageLoader /> or <PageLoader message="Loading data..." />
 */
export const PageLoader = ({ 
  fullPage = false, 
  message = "Chargement...",
  className 
}: PageLoaderProps) => {
  if (fullPage) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center bg-background",
        className
      )}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center justify-center p-8",
      className
    )}>
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

/**
 * Pre-configured Suspense fallback for lazy-loaded routes.
 * Use directly in Suspense: <Suspense fallback={<SuspenseFallback />}>
 */
export const SuspenseFallback = () => <PageLoader />;

/**
 * Pre-configured full page Suspense fallback.
 * Use for main route loading: <Suspense fallback={<FullPageFallback />}>
 */
export const FullPageFallback = () => <PageLoader fullPage />;
