import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExploreModalProps {
  isVisible: boolean;
  onDismiss: () => void;
  onExplore: () => void;
}

export function ExploreModal({ isVisible, onDismiss, onExplore }: ExploreModalProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    if (isVisible) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onDismiss}
            data-testid="modal-explore-backdrop"
          />
          
          <motion.div
            className="fixed bottom-4 left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:max-w-md z-50"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.23, 1, 0.32, 1]
            }}
            data-testid="modal-explore-content"
          >
            <div className="relative bg-white rounded-2xl shadow-2xl border border-[hsl(30,20%,88%)] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(18,45%,96%)] to-white opacity-60" />
              
              <div className="relative p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(18,55%,88%)] to-[hsl(18,60%,78%)] flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Sparkles className="w-6 h-6 text-[hsl(18,65%,40%)]" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-xl font-medium text-[hsl(25,30%,12%)] mb-1" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                        Ready to streamline your practice?
                      </h3>
                      <p className="text-sm text-[hsl(25,20%,45%)]">
                        Join our founding cohort of forward-thinking firms
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={onDismiss}
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0"
                    aria-label="Dismiss"
                    data-testid="button-modal-dismiss"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <p className="text-[hsl(25,20%,35%)] mb-6 leading-relaxed">
                  Get early access and discover how contemporaneous records can strengthen your professional defensibility.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={onExplore}
                    className="flex-1 bg-[hsl(18,70%,42%)] text-white shadow-md"
                    data-testid="button-modal-request-access"
                  >
                    Request Early Access
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button
                    onClick={onDismiss}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-modal-maybe-later"
                  >
                    Maybe later
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function useExploreModal(triggerElementId: string) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasBeenDismissed, setHasBeenDismissed] = useState(false);
  const [hasBeenTriggered, setHasBeenTriggered] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("explore-modal-dismissed");
    if (dismissed === "true") {
      setHasBeenDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (hasBeenDismissed || hasBeenTriggered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            setHasBeenTriggered(true);
            setTimeout(() => {
              setIsVisible(true);
            }, 800);
          }
        });
      },
      {
        threshold: 0,
        rootMargin: "-100px 0px 0px 0px"
      }
    );

    const element = document.getElementById(triggerElementId);
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [triggerElementId, hasBeenDismissed, hasBeenTriggered]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setHasBeenDismissed(true);
    sessionStorage.setItem("explore-modal-dismissed", "true");
  }, []);

  const show = useCallback(() => {
    if (!hasBeenDismissed) {
      setIsVisible(true);
    }
  }, [hasBeenDismissed]);

  return {
    isVisible,
    dismiss,
    show,
    hasBeenDismissed
  };
}
