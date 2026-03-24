import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { useTheme } from "../lib/theme.ts";

export default function Layout() {
  const { user, login, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white">
      <div className="racing-stripe" />

      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            to={user ? "/dashboard" : "/"}
            className="font-pixel text-base flex items-center gap-2"
            style={{ color: "var(--green)" }}
          >
            <span className="stoplight-mini">
              <span className="stoplight-mini-dot red active" />
              <span className="stoplight-mini-dot yellow active" />
              <span className="stoplight-mini-dot green active" />
            </span>
            GIT RACER
          </Link>

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
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--green-bright)"}
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
