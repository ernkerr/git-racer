import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import Leaderboard from "../components/Leaderboard.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center mb-4 scanlines">
        <h1 className="font-pixel leading-loose mb-8">
          <span
            className="block text-2xl md:text-4xl text-arcade-pink"
            style={{ textShadow: "3px 3px 0px #000" }}
          >
            RACE YOUR
          </span>
          <span
            className="block text-2xl md:text-4xl text-arcade-yellow"
            style={{ textShadow: "3px 3px 0px #000" }}
          >
            COMMITS.
          </span>
        </h1>
        <p className="font-mono text-sm text-arcade-gray max-w-lg mb-10 leading-relaxed">
          Race your friends, race famous developers, and turn your GitHub
          contributions into a competitive sport.
        </p>
        <button
          onClick={login}
          className="btn-arcade bg-arcade-pink text-black font-pixel text-sm px-8 py-4 mb-4"
        >
          PRESS START
        </button>
        <p className="font-pixel text-[10px] text-arcade-gray blink">
          INSERT COIN TO CONTINUE
        </p>
        <p className="font-mono text-xs text-arcade-gray mt-6">
          We only request read access to your profile. No repo access needed.
        </p>
      </div>

      <div className="checker-divider my-10" />

      <Leaderboard />
    </div>
  );
}
