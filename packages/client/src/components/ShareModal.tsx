import { useEffect } from "react";
import ShareLinks from "./ShareLinks.tsx";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareText: string;
  shareUrl: string;
}

export default function ShareModal({ open, onClose, shareText, shareUrl }: ShareModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: "Git Racer", text: shareText, url: shareUrl });
    } catch {
      // user cancelled
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" style={{ animation: "fade-in 0.15s ease-out" }} />

      <div
        className="relative w-full md:w-96 md:rounded-lg bg-arcade-surface border-t-3 md:border-3 border-arcade-border p-5"
        style={{
          animation: "slide-up 0.2s ease-out",
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4 md:hidden">
          <div className="w-10 h-1 rounded-full bg-arcade-gray/40" />
        </div>

        <h3 className="font-pixel text-sm text-arcade-white mb-4">SHARE THIS RACE</h3>

        <ShareLinks
          shareText={shareText}
          shareUrl={shareUrl}
          onShare={onClose}
          className="space-y-2"
        />

        {canNativeShare && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center gap-3 px-4 py-3 rounded transition-colors hover:bg-arcade-bg mt-2"
          >
            <svg className="w-5 h-5 text-arcade-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="font-pixel text-xs text-arcade-white">MORE...</span>
          </button>
        )}

        <button
          onClick={onClose}
          className="hidden md:block mt-4 w-full btn-arcade bg-arcade-bg text-arcade-gray font-pixel text-xs py-2"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
}
