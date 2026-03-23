import { useState } from "react";
import { api } from "../lib/api.ts";
import type { ShareData } from "@git-racer/shared";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const data = await api<ShareData>("/me/share");

      if (navigator.share) {
        await navigator.share({ text: data.text });
      } else {
        await navigator.clipboard.writeText(data.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled share or clipboard failed
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className="btn-arcade bg-arcade-surface font-pixel text-[8px] px-3 py-2 flex items-center gap-1.5"
    >
      {copied ? (
        <span className="text-arcade-cyan">✓ COPIED!</span>
      ) : (
        <>
          <svg className="w-4 h-4 text-arcade-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-arcade-white">{loading ? "..." : "SHARE"}</span>
        </>
      )}
    </button>
  );
}
