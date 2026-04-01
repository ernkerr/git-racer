import { useState, useEffect } from "react";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  shareText: string;
  shareUrl: string;
}

export default function ShareModal({ open, onClose, shareText, shareUrl }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer,width=550,height=420"
    );
    onClose();
  };

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" style={{ animation: "fade-in 0.15s ease-out" }} />

      {/* Panel: bottom drawer on mobile, centered modal on desktop */}
      <div
        className="relative w-full md:w-96 md:rounded-lg bg-arcade-surface border-t-3 md:border-3 border-arcade-border p-5"
        style={{
          animation: "slide-up 0.2s ease-out",
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center mb-4 md:hidden">
          <div className="w-10 h-1 rounded-full bg-arcade-gray/40" />
        </div>

        <h3 className="font-pixel text-sm text-arcade-white mb-4">SHARE THIS RACE</h3>

        <div className="space-y-2">
          {/* Copy Link */}
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded transition-colors hover:bg-arcade-bg"
          >
            <svg className="w-5 h-5 text-arcade-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span className="font-pixel text-xs text-arcade-white">
              {copied ? "COPIED!" : "COPY LINK"}
            </span>
          </button>

          {/* Share to X */}
          <button
            onClick={handleShareX}
            className="w-full flex items-center gap-3 px-4 py-3 rounded transition-colors hover:bg-arcade-bg"
          >
            <svg className="w-5 h-5 text-arcade-gray shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-pixel text-xs text-arcade-white">SHARE TO X</span>
          </button>

          {/* Native share (mobile — covers TikTok, Instagram, WhatsApp, etc.) */}
          {canNativeShare && (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 px-4 py-3 rounded transition-colors hover:bg-arcade-bg"
            >
              <svg className="w-5 h-5 text-arcade-gray shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="font-pixel text-xs text-arcade-white">MORE...</span>
              <span className="font-mono text-[10px] text-arcade-gray ml-auto">TIKTOK, INSTAGRAM, etc.</span>
            </button>
          )}
        </div>

        {/* Close button (desktop) */}
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
