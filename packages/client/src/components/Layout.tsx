import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { useTheme } from "../lib/theme.ts";

export default function Layout() {
  const { user, login, logout } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white">
      {/* Racing stripe accent */}
      <div className="racing-stripe" />

      <header
        className="bg-arcade-surface border-b-3 border-arcade-border"
        style={{ boxShadow: "0 4px 0 var(--arcade-shadow)" }}
      >
        <nav className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={user ? "/dashboard" : "/"}
            className="font-pixel text-lg text-arcade-pink flex items-center gap-2"
          >
            <span className="stoplight-mini">
              <span className="stoplight-mini-dot red active" />
              <span className="stoplight-mini-dot yellow active" />
              <span className="stoplight-mini-dot green active" />
            </span>
            GIT RACER
          </Link>
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center text-arcade-gray hover:text-arcade-pink transition-colors"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {user ? (
              <>
                <Link
                  to="/challenges/new"
                  className="btn-arcade bg-arcade-cyan text-white font-pixel text-xs px-3 py-2"
                >
                  NEW RACE
                </Link>
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar_url ?? ""}
                    alt={user.github_username}
                    className="w-8 h-8 rounded-none border-3 border-arcade-border"
                  />
                  <span className="text-sm text-arcade-gray">{user.github_username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-arcade-gray hover:text-arcade-pink transition-colors font-medium"
                >
                  LOG OUT
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="btn-arcade bg-arcade-pink text-black font-pixel text-xs px-4 py-2"
              >
                SIGN IN
              </button>
            )}
          </div>
        </nav>
      </header>
      <div className="checker-divider" />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
