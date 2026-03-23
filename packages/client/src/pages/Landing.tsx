import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import Leaderboard from "../components/Leaderboard.tsx";

export default function Landing() {
  const { user, loading, login } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center mb-4">
        {/* Racing stoplight */}
        <div className="stoplight stoplight-animated mb-10">
          <div className="stoplight-dot red" />
          <div className="stoplight-dot yellow" />
          <div className="stoplight-dot green" />
        </div>

        <h1 className="font-pixel leading-tight mb-8">
          <span className="block text-3xl md:text-5xl text-arcade-pink">
            RACE YOUR
          </span>
          <span className="block text-3xl md:text-5xl text-arcade-white">
            COMMITS.
          </span>
        </h1>
        <p className="text-base text-arcade-gray max-w-lg mb-10 leading-relaxed">
          Race your friends, race famous developers, and turn your GitHub
          contributions into a competitive sport.
        </p>

        <div className="checker-frame inline-block">
          <button
            onClick={login}
            className="btn-arcade bg-arcade-pink text-black font-pixel text-base px-8 py-4"
          >
            GET STARTED
          </button>
        </div>

        <p className="text-xs text-arcade-gray mt-8">
          We only request read access to your profile. No repo access needed.
        </p>
      </div>

      <div className="checker-divider my-10" />

      <Leaderboard />
    </div>
  );
}
