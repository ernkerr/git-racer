import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import Hyperspeed from "../components/Hyperspeed.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white">
      {/* ── Header ── */}
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
          <button
            onClick={login}
            className="font-pixel text-xs px-4 py-2 transition-colors"
            style={{ background: "var(--green)", color: "#000", border: "none" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-hi)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
          >
            SIGN IN
          </button>
        </nav>
      </header>

      {/* ── Hero — full viewport, Hyperspeed behind ── */}
      <section
        className="relative flex items-center justify-center"
        style={{ height: "calc(100vh - 3.5rem)" }}
      >
        {/* Background animation */}
        <div className="absolute inset-0 overflow-hidden">
          <Hyperspeed />
        </div>

        {/* Dark scrim for readability */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)" }} />

        {/* Content — shifted up with pb-32 */}
        <div className="relative z-10 text-center px-6 pb-32">
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
            className="font-pixel text-sm px-8 py-3 transition-colors"
            style={{ background: "var(--green)", color: "#000" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-hi)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
          >
            SIGN IN WITH GITHUB
          </button>
        </div>

        {/* Bottom fade into next section */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: "linear-gradient(to top, var(--bg), transparent)" }}
        />
      </section>

      {/* ── Below the fold ── */}
      <p className="text-xs text-center py-6" style={{ color: "var(--muted)" }}>
        Read-only access. No repo permissions needed.
      </p>

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
              <p className="font-pixel text-xl mb-3" style={{ color: "var(--green-lo)" }}>{n}</p>
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
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-hi)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
        >
          SIGN IN WITH GITHUB
        </button>
      </div>
    </div>
  );
}
