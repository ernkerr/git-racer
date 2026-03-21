import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import Leaderboard from "../components/Leaderboard.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center mb-12">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Race your commits.
        </h1>
        <p className="text-xl text-gray-400 max-w-lg mb-8">
          Challenge friends, race famous developers, and turn your GitHub
          contributions into a competitive sport.
        </p>
        <button
          onClick={login}
          className="bg-white text-gray-900 hover:bg-gray-200 px-6 py-3 rounded-lg font-semibold text-lg transition-colors"
        >
          Sign in with GitHub
        </button>
        <p className="text-sm text-gray-500 mt-4">
          We only request read access to your profile. No repo access needed.
        </p>
      </div>

      <Leaderboard />
    </div>
  );
}
