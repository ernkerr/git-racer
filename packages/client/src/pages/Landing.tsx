import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { useTheme } from "../lib/theme.ts";
import Hyperspeed from "../components/Hyperspeed.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();
  const { theme, toggle } = useTheme();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white">
      {/* ── Header (same as Layout but self-contained) ── */}
      <div className="racing-stripe" />
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "relative", zIndex: 10 }}>
        <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-pixel text-base flex items-center gap-2" style={{ color: "var(--green)" }}>
            <span className="stoplight stoplight-animated" style={{ padding: "4px 8px", gap: "4px" }}>
              <span className="stoplight-dot red" style={{ width: 8, height: 8 }} />
              <span className="stoplight-dot yellow" style={{ width: 8, height: 8 }} />
              <span className="stoplight-dot green" style={{ width: 8, height: 8 }} />
            </span>
            GIT RACER
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center transition-colors"
              style={{ color: "var(--muted)" }}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={login}
              className="font-pixel text-xs px-4 py-2 transition-colors"
              style={{ background: "var(--green)", color: "#000", border: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-bright)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
            >
              SIGN IN
            </button>
          </div>
        </nav>
      </header>

      {/* ── Hero — full viewport, Hyperspeed behind ── */}
      <section
        className="relative flex items-center justify-center"
        style={{ height: "calc(100vh - 3.5rem - 2px)" }}
      >
        {/* Background animation */}
        <div className="absolute inset-0 overflow-hidden">
          <Hyperspeed />
        </div>

        {/* Dark scrim for readability */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)" }} />

        {/* Content */}
        <div className="relative z-10 text-center px-6">
          <h1 className="font-pixel leading-tight mb-5">
            <span className="block text-4xl md:text-6xl" style={{ color: "var(--green)" }}>
              RACE YOUR
            </span>
            <span className="block text-4xl md:text-6xl" style={{ color: "var(--text)" }}>
              COMMITS.
            </span>
          </h1>

          <p className="text-base mb-10 max-w-md mx-auto leading-relaxed" style={{ color: "#ccc" }}>
            Race your friends, race famous developers, and turn your
            GitHub contributions into a competitive sport.
          </p>

          <button
            onClick={login}
            className="font-pixel text-sm px-8 py-3 mb-4 transition-colors"
            style={{ background: "var(--green)", color: "#000" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-bright)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
          >
            SIGN IN WITH GITHUB
          </button>

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Read-only access. No repo permissions needed.
          </p>
        </div>

        {/* Bottom fade into next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: "linear-gradient(to top, var(--bg), transparent)" }}
        />
      </section>

      {/* ── How it works ── */}
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h2 className="font-pixel text-sm text-center mb-8" style={{ color: "var(--green)" }}>HOW IT WORKS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { n: "01", title: "PICK YOUR OPPONENT", body: "Search any GitHub username — a friend, a famous dev, your coworker." },
            { n: "02", title: "LOAD REAL HISTORY", body: "We pull actual commit counts from GitHub — your real totals, not starting from 0." },
            { n: "03", title: "RACE OR SPRINT", body: "Set a deadline for a sprint, or run an ongoing race with no end date." },
          ].map(({ n, title, body }) => (
            <div key={n} className="p-5" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
              <p className="font-pixel text-xl mb-3" style={{ color: "var(--green-dim)" }}>{n}</p>
              <p className="font-pixel text-xs mb-2" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div className="text-center px-6 py-12" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="font-pixel text-base mb-6" style={{ color: "var(--text)" }}>READY TO RACE?</p>
        <button
          onClick={login}
          className="font-pixel text-sm px-8 py-3 transition-colors"
          style={{ background: "var(--green)", color: "#000" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-bright)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
        >
          SIGN IN WITH GITHUB
        </button>
      </div>
    </div>
  );
}
