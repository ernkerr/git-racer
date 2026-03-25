import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import Hyperspeed from "../components/Hyperspeed.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      {/* Hero — Hyperspeed background with content on top */}
      <div className="relative flex flex-col items-center justify-center text-center -my-10" style={{ minHeight: "calc(100vh - 3.5rem - 2px)" }}>
        <div className="absolute inset-0 -mx-6 overflow-hidden" style={{ zIndex: 0 }}>
          <Hyperspeed />
          {/* gradient fade so content below blends smoothly */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32"
            style={{ background: "linear-gradient(to top, var(--bg), transparent)" }}
          />
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 className="font-pixel leading-tight mb-5">
            <span className="block text-4xl md:text-6xl" style={{ color: "var(--green)" }}>
              RACE YOUR
            </span>
            <span className="block text-4xl md:text-6xl" style={{ color: "var(--text)" }}>
              COMMITS.
            </span>
          </h1>

          <p
            className="text-base mb-10 max-w-md mx-auto leading-relaxed"
            style={{
              color: "var(--text)",
              textShadow: "0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)",
            }}
          >
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
      </div>

      {/* How it works */}
      <div className="max-w-2xl mx-auto py-16">
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

      {/* Bottom CTA */}
      <div className="text-center py-12" style={{ borderTop: "1px solid var(--border)" }}>
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
