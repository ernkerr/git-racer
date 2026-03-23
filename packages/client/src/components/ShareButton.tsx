import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api.ts";
import type { ShareData } from "@git-racer/shared";

export default function ShareButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchShareData = async () => {
    if (shareData) return shareData;
    setLoading(true);
    try {
      const data = await api<ShareData>("/me/share");
      setShareData(data);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!open) {
      await fetchShareData();
    }
    setOpen(!open);
  };

  const handleCopy = async () => {
    const data = shareData || (await fetchShareData());
    if (!data) return;
    await navigator.clipboard.writeText(data.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const handleTweet = async () => {
    const data = shareData || (await fetchShareData());
    if (!data) return;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.tweet)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        disabled={loading}
        className="btn-arcade bg-arcade-surface font-pixel text-xs px-3 py-2 flex items-center gap-1.5"
      >
        <svg className="w-4 h-4 text-arcade-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span className="text-arcade-white">{loading ? "..." : "SHARE"}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 retro-box bg-arcade-surface z-50 min-w-[160px]">
          <button
            onClick={handleCopy}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-arcade-white hover:bg-arcade-bg transition-colors flex items-center gap-2"
          >
            {copied ? "Copied!" : "Copy Stats"}
          </button>
          <div className="border-t-2 border-black" />
          <button
            onClick={handleTweet}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-arcade-white hover:bg-arcade-bg transition-colors flex items-center gap-2"
          >
            Share to X
          </button>
        </div>
      )}
    </div>
  );
}
