import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

function MockRaceCard() {
  return (
    <div
      className="max-w-sm mx-auto p-5"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-pixel text-xs" style={{ color: "var(--green)" }}>RACE IN PROGRESS</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>ongoing</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <img
            src="https://github.com/ghost.png"
            alt="you"
            className="w-12 h-12 rounded-full mx-auto mb-2"
            style={{ border: "2px solid var(--green)" }}
          />
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>you</p>
          <p className="font-pixel text-3xl" style={{ color: "var(--green)" }}>847</p>
        </div>
        <div className="text-center">
          <img
            src="https://github.com/torvalds.png"
            alt="torvalds"
            className="w-12 h-12 rounded-full mx-auto mb-2"
            style={{ border: "1px solid var(--border)" }}
          />
          <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>torvalds</p>
          <p className="font-pixel text-3xl" style={{ color: "var(--text)" }}>412</p>
        </div>
      </div>
      <div className="relative h-1.5 mt-5 mb-3" style={{ background: "var(--border)" }}>
        <div className="absolute left-0 top-0 h-full" style={{ width: "67%", background: "var(--green)" }} />
      </div>
      <p className="font-pixel text-xs text-center" style={{ color: "var(--green)" }}>YOU LEAD BY 435</p>
    </div>
  );
}

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      {/* Hero */}
      <div className="flex flex-col items-center justify-center min-h-[55vh] text-center">
        <div className="stoplight stoplight-animated mb-10">
          <div className="stoplight-dot red" />
          <div className="stoplight-dot yellow" />
          <div className="stoplight-dot green" />
        </div>

        <h1 className="font-pixel leading-tight mb-5">
          <span className="block text-4xl md:text-6xl" style={{ color: "var(--green)" }}>
            RACE YOUR
          </span>
          <span className="block text-4xl md:text-6xl" style={{ color: "var(--text)" }}>
            COMMITS.
          </span>
        </h1>

        <p className="text-base mb-10 max-w-md leading-relaxed" style={{ color: "var(--muted)" }}>
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

      {/* Divider */}
      <div className="my-16" style={{ borderTop: "1px solid var(--border)" }} />

      {/* How it works */}
      <div className="max-w-2xl mx-auto mb-16">
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

      {/* Mock race */}
      <div className="mb-16">
        <h2 className="font-pixel text-sm text-center mb-6" style={{ color: "var(--green)" }}>WHAT A RACE LOOKS LIKE</h2>
        <MockRaceCard />
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
