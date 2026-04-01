import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export default function Layout() {
  const { user, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white overflow-x-hidden">
      <div className="racing-stripe" />

      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            to={user ? "/dashboard" : "/"}
            className="font-pixel text-base flex items-center gap-2"
            style={{ color: "var(--green)" }}
          >
            <span className="stoplight stoplight-animated" style={{ padding: "4px 8px", gap: "4px" }}>
              <span className="stoplight-dot red" style={{ width: 8, height: 8 }} />
              <span className="stoplight-dot yellow" style={{ width: 8, height: 8 }} />
              <span className="stoplight-dot green" style={{ width: 8, height: 8 }} />
            </span>
            GIT RACER
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/challenges/new"
                  className="font-pixel text-xs px-3 py-1.5 transition-colors"
                  style={{
                    border: "1px solid var(--green)",
                    color: "var(--green)",
                    background: "transparent",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "var(--green)";
                    (e.currentTarget as HTMLElement).style.color = "#000";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "var(--green)";
                  }}
                >
                  NEW RACE
                </Link>
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar_url ?? ""}
                    alt={user.github_username}
                    className="w-7 h-7 rounded-full"
                    style={{ border: "1px solid var(--border)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--muted)" }}>{user.github_username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-xs font-medium transition-colors"
                  style={{ color: "var(--muted)" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--green)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--muted)"}
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="font-pixel text-xs px-4 py-2 transition-colors"
                style={{ background: "var(--green)", color: "#000", border: "none" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-hi)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--green)"}
              >
                SIGN IN
              </button>
            )}
          </div>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
