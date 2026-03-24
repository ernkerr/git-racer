import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

function MockRaceCard() {
  return (
    <div className="retro-box bg-arcade-surface p-5 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="font-pixel text-[10px] px-1.5 py-0.5 border-2 border-arcade-pink text-arcade-pink">RACE</span>
        <span className="font-mono text-xs text-arcade-gray">vs torvalds</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="text-center">
          <img
            src="https://github.com/ghost.png"
            alt="you"
            className="w-10 h-10 rounded-none border-3 border-arcade-border mx-auto mb-1"
          />
          <p className="font-pixel text-[10px] text-arcade-gray">you</p>
          <p className="font-pixel text-3xl tabular-nums text-arcade-pink mt-1">847</p>
        </div>
        <div className="text-center">
          <img
            src="https://github.com/torvalds.png"
            alt="torvalds"
            className="w-10 h-10 rounded-none border-3 border-arcade-border mx-auto mb-1"
          />
          <p className="font-pixel text-[10px] text-arcade-gray">torvalds</p>
          <p className="font-pixel text-3xl tabular-nums text-arcade-white mt-1">412</p>
        </div>
      </div>
      <div className="relative h-5 mt-3 mb-2">
        <div className="absolute inset-0 flex">
          <div className="h-full bg-arcade-pink" style={{ width: "67%" }} />
          <div className="h-full flex-1 bg-arcade-surface border border-arcade-border" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-pixel text-[10px] text-black bg-arcade-white px-1.5 z-10">VS</span>
        </div>
      </div>
      <p className="font-pixel text-xs text-arcade-pink text-center">YOU LEAD BY 435</p>
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center mb-8">
        {/* Racing stoplight */}
        <div className="stoplight stoplight-animated mb-10">
          <div className="stoplight-dot red" />
          <div className="stoplight-dot yellow" />
          <div className="stoplight-dot green" />
        </div>

        <h1 className="font-pixel leading-tight mb-6">
          <span className="block text-3xl md:text-5xl text-arcade-pink">
            RACE YOUR
          </span>
          <span className="block text-3xl md:text-5xl text-arcade-white">
            COMMITS.
          </span>
        </h1>
        <p className="text-base text-arcade-gray max-w-lg mb-10 leading-relaxed">
          Look up any developer on GitHub, see your real commit totals head-to-head,
          and race to outcode them. No leaderboards. Just you vs. whoever you want to beat.
        </p>

        <div className="checker-frame inline-block mb-8">
          <button
            onClick={login}
            className="btn-arcade bg-arcade-pink text-black font-pixel text-base px-8 py-4"
          >
            START RACING
          </button>
        </div>

        <p className="text-xs text-arcade-gray">
          We only request read access to your profile. No repo access needed.
        </p>
      </div>

      <div className="checker-divider my-10" />

      {/* How it works */}
      <div className="max-w-2xl mx-auto mb-16">
        <h2 className="font-pixel text-lg text-arcade-cyan text-center mb-8">HOW IT WORKS</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="retro-box bg-arcade-surface p-5 text-center">
            <p className="font-pixel text-2xl text-arcade-pink mb-3">01</p>
            <p className="font-pixel text-xs text-arcade-white mb-2">PICK YOUR OPPONENT</p>
            <p className="font-mono text-xs text-arcade-gray leading-relaxed">
              Search any GitHub username — a friend, a famous dev, your coworker.
            </p>
          </div>
          <div className="retro-box bg-arcade-surface p-5 text-center">
            <p className="font-pixel text-2xl text-arcade-cyan mb-3">02</p>
            <p className="font-pixel text-xs text-arcade-white mb-2">LOAD REAL HISTORY</p>
            <p className="font-mono text-xs text-arcade-gray leading-relaxed">
              We pull actual commit counts from GitHub — not starting from 0, but your real totals.
            </p>
          </div>
          <div className="retro-box bg-arcade-surface p-5 text-center">
            <p className="font-pixel text-2xl text-arcade-pink mb-3">03</p>
            <p className="font-pixel text-xs text-arcade-white mb-2">RACE OR SPRINT</p>
            <p className="font-mono text-xs text-arcade-gray leading-relaxed">
              Set a deadline for a sprint, or run an ongoing race with no end date.
            </p>
          </div>
        </div>
      </div>

      {/* Mock race preview */}
      <div className="mb-16">
        <h2 className="font-pixel text-lg text-arcade-cyan text-center mb-6">WHAT A RACE LOOKS LIKE</h2>
        <MockRaceCard />
      </div>

      <div className="checker-divider my-10" />

      {/* Final CTA */}
      <div className="text-center py-10">
        <p className="font-pixel text-base text-arcade-white mb-6">READY TO RACE?</p>
        <div className="checker-frame inline-block">
          <button
            onClick={login}
            className="btn-arcade bg-arcade-pink text-black font-pixel text-base px-8 py-4"
          >
            SIGN IN WITH GITHUB
          </button>
        </div>
      </div>
    </div>
  );
}
