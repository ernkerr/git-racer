import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export default function Layout() {
  const { user, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-white">
      <header
        className="bg-arcade-surface border-b-4 border-black"
        style={{ boxShadow: "0 4px 0 #000" }}
      >
        <nav className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to={user ? "/dashboard" : "/"}
            className="font-pixel text-sm text-arcade-yellow leading-loose"
            style={{ textShadow: "3px 3px 0px #FF006E" }}
          >
            GIT RACER
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/challenges/new"
                  className="btn-arcade bg-arcade-cyan text-black font-pixel text-[8px] px-3 py-2"
                >
                  NEW RACE
                </Link>
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar_url ?? ""}
                    alt={user.github_username}
                    className="w-8 h-8 rounded-none border-2 border-arcade-yellow"
                  />
                  <span className="font-pixel text-[8px] text-arcade-gray">{user.github_username}</span>
                </div>
                <button
                  onClick={logout}
                  className="font-pixel text-[8px] text-arcade-gray hover:text-arcade-pink transition-colors"
                >
                  LOGOUT
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="btn-arcade bg-arcade-pink text-black font-pixel text-[8px] px-4 py-2"
              >
                INSERT COIN
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
