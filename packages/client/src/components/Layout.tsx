import { Outlet, Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export default function Layout() {
  const { user, login, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800">
        <nav className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={user ? "/dashboard" : "/"} className="text-xl font-bold tracking-tight">
            Git Racer
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link
                  to="/challenges/new"
                  className="text-sm bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-md transition-colors"
                >
                  New Challenge
                </Link>
                <div className="flex items-center gap-2">
                  <img
                    src={user.avatar_url ?? ""}
                    alt={user.github_username}
                    className="w-8 h-8 rounded-full"
                  />
                  <span className="text-sm text-gray-300">{user.github_username}</span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={login}
                className="text-sm bg-white text-gray-900 hover:bg-gray-200 px-4 py-1.5 rounded-md font-medium transition-colors"
              >
                Sign in with GitHub
              </button>
            )}
          </div>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
