import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

export interface LightboxImage {
  url: string;
  title?: string;
  description?: string;
  isVideo?: boolean;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Reset index when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
    }
  }, [open, initialIndex]);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setIsLoading(true);
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setIsLoading(true);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrevious, goToNext, onOpenChange]);

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Preload adjacent images
  useEffect(() => {
    if (!open || images.length <= 1) return;

    const preloadIndices = [
      (currentIndex + 1) % images.length,
      (currentIndex - 1 + images.length) % images.length,
    ];

    preloadIndices.forEach((index) => {
      const img = images[index];
      if (img && !img.isVideo) {
        const preloadImg = new Image();
        preloadImg.src = img.url;
      }
    });
  }, [currentIndex, images, open]);

  if (!currentImage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] w-screen h-screen max-h-screen p-0 border-0 bg-black/95 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <VisuallyHidden.Root>
          <DialogTitle>{currentImage.title || "Image"}</DialogTitle>
          <DialogDescription>
            {currentImage.description || "Visualisation d'image"}
          </DialogDescription>
        </VisuallyHidden.Root>

        {/* Header with counter and close */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          {hasMultiple && (
            <span className="text-white/90 text-sm font-medium bg-black/30 px-3 py-1 rounded-full">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          <div className={cn(!hasMultiple && "ml-auto")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Main image container */}
        <div className="relative flex items-center justify-center w-full h-full">
          {/* Previous button */}
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPrevious}
              className="absolute left-2 md:left-4 z-40 text-white hover:bg-white/20 rounded-full h-12 w-12 md:h-14 md:w-14"
            >
              <ChevronLeft className="h-8 w-8 md:h-10 md:w-10" />
            </Button>
          )}

          {/* Image/Video */}
          <div className="relative max-w-full max-h-full flex items-center justify-center px-16">
            {currentImage.isVideo ? (
              <video
                src={currentImage.url}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : (
              <>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <img
                  src={currentImage.url}
                  alt={currentImage.title || "Image"}
                  className={cn(
                    "max-w-full max-h-[80vh] object-contain transition-opacity duration-200",
                    isLoading ? "opacity-0" : "opacity-100"
                  )}
                  onLoad={() => setIsLoading(false)}
                  onError={() => setIsLoading(false)}
                />
              </>
            )}
          </div>

          {/* Next button */}
          {hasMultiple && (
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNext}
              className="absolute right-2 md:right-4 z-40 text-white hover:bg-white/20 rounded-full h-12 w-12 md:h-14 md:w-14"
            >
              <ChevronRight className="h-8 w-8 md:h-10 md:w-10" />
            </Button>
          )}
        </div>

        {/* Footer with title and description */}
        {(currentImage.title || currentImage.description) && (
          <div className="absolute bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-gradient-to-t from-black/80 to-transparent">
            <div className="max-w-3xl mx-auto text-center">
              {currentImage.title && (
                <h3 className="text-white text-lg md:text-xl font-semibold mb-1">
                  {currentImage.title}
                </h3>
              )}
              {currentImage.description && (
                <p className="text-white/80 text-sm md:text-base">
                  {currentImage.description}
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
