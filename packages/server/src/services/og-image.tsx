/**
 * OG image generation using @vercel/og (satori + resvg).
 *
 * Produces 1200x630 PNG images for social media previews.
 */
import { ImageResponse } from "@vercel/og";

interface ChallengeOgData {
  name: string;
  participants: { username: string; commits: number }[];
  type: string;
}

interface UserOgData {
  username: string;
  stats: {
    today: number;
    this_week: number;
    this_month: number;
    this_year: number;
    all_time: number;
  };
  streak: number;
  weekLabel: string;
}

export function renderChallengeOgImage(data: ChallengeOgData): ImageResponse {
  const top3 = data.participants.slice(0, 3);
  const racerCount = data.participants.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0C0C0C",
          color: "#F0F0F0",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
          <span style={{ fontSize: "28px", color: "#00C853", fontWeight: 700 }}>⚡ GIT RACER</span>
        </div>

        {/* Challenge name */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: "8px",
            lineClamp: 2,
            overflow: "hidden",
          }}
        >
          {data.name}
        </div>

        <div style={{ fontSize: "22px", color: "#666", marginBottom: "40px" }}>
          {racerCount} {racerCount === 1 ? "racer" : "racers"} competing
        </div>

        {/* Leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
          {top3.map((p, i) => (
            <div
              key={p.username}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                padding: "16px 24px",
                borderRadius: "8px",
                backgroundColor: i === 0 ? "#1a2e1a" : "#141414",
                border: `2px solid ${i === 0 ? "#00C853" : "#2A2A2A"}`,
              }}
            >
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: i === 0 ? "#00C853" : "#666",
                  width: "48px",
                }}
              >
                #{i + 1}
              </span>
              <span style={{ fontSize: "28px", fontWeight: 600, color: "#F0F0F0", flex: 1 }}>
                {p.username}
              </span>
              <span
                style={{
                  fontSize: "32px",
                  fontWeight: 700,
                  color: i === 0 ? "#00C853" : "#F0F0F0",
                }}
              >
                {p.commits.toLocaleString()}
              </span>
              <span style={{ fontSize: "18px", color: "#666" }}>commits</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid #2A2A2A",
          }}
        >
          <span style={{ fontSize: "18px", color: "#666" }}>git-racer.com</span>
          <span style={{ fontSize: "18px", color: "#00C853" }}>Race your commits 🏎️</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

interface InviteOgData {
  challengeName: string;
  inviterUsername: string;
  durationLabel: string;
  racerCount: number;
}

export function renderInviteOgImage(data: InviteOgData): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0C0C0C",
          color: "#F0F0F0",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "48px" }}>
          <span style={{ fontSize: "28px", color: "#00C853", fontWeight: 700 }}>⚡ GIT RACER</span>
        </div>

        {/* Challenge callout */}
        <div
          style={{
            fontSize: "28px",
            color: "#666",
            marginBottom: "16px",
            textTransform: "uppercase",
            letterSpacing: "2px",
          }}
        >
          You've been challenged!
        </div>

        {/* Inviter */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          {data.inviterUsername}
        </div>

        <div
          style={{
            fontSize: "28px",
            color: "#00C853",
            marginBottom: "40px",
          }}
        >
          wants to race you
        </div>

        {/* Race info */}
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 40px",
              borderRadius: "8px",
              backgroundColor: "#141414",
              border: "2px solid #2A2A2A",
            }}
          >
            <span style={{ fontSize: "14px", color: "#666", letterSpacing: "1px", marginBottom: "8px" }}>
              RACE
            </span>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#FFFFFF" }}>
              {data.challengeName}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 40px",
              borderRadius: "8px",
              backgroundColor: "#141414",
              border: "2px solid #2A2A2A",
            }}
          >
            <span style={{ fontSize: "14px", color: "#666", letterSpacing: "1px", marginBottom: "8px" }}>
              DURATION
            </span>
            <span style={{ fontSize: "24px", fontWeight: 700, color: "#FFFFFF" }}>
              {data.durationLabel}
            </span>
          </div>
          {data.racerCount > 2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px 40px",
                borderRadius: "8px",
                backgroundColor: "#141414",
                border: "2px solid #2A2A2A",
              }}
            >
              <span style={{ fontSize: "14px", color: "#666", letterSpacing: "1px", marginBottom: "8px" }}>
                RACERS
              </span>
              <span style={{ fontSize: "24px", fontWeight: 700, color: "#FFFFFF" }}>
                {data.racerCount}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: "auto",
            paddingTop: "16px",
            borderTop: "1px solid #2A2A2A",
          }}
        >
          <span style={{ fontSize: "18px", color: "#666" }}>git-racer.com</span>
          <span style={{ fontSize: "18px", color: "#00C853" }}>Race your commits 🏎️</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

export function renderUserOgImage(data: UserOgData): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0C0C0C",
          color: "#F0F0F0",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontSize: "28px", color: "#00C853", fontWeight: 700 }}>⚡ GIT RACER</span>
          <span style={{ fontSize: "22px", color: "#666" }}>{data.weekLabel}</span>
        </div>

        {/* Username */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: 700,
            color: "#FFFFFF",
            marginBottom: "40px",
          }}
        >
          {data.username}
        </div>

        {/* Stats grid */}
        <div style={{ display: "flex", gap: "32px", marginBottom: "32px" }}>
          {[
            { label: "TODAY", value: data.stats.today },
            { label: "THIS WEEK", value: data.stats.this_week },
            { label: "THIS MONTH", value: data.stats.this_month },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px 32px",
                borderRadius: "8px",
                backgroundColor: "#141414",
                border: "2px solid #2A2A2A",
                flex: 1,
              }}
            >
              <span style={{ fontSize: "16px", color: "#666", letterSpacing: "1px", marginBottom: "8px" }}>
                {s.label}
              </span>
              <span style={{ fontSize: "44px", fontWeight: 700, color: "#FFFFFF" }}>
                {s.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "32px", marginBottom: "32px" }}>
          {[
            { label: "THIS YEAR", value: data.stats.this_year },
            { label: "ALL TIME", value: data.stats.all_time },
            ...(data.streak > 0 ? [{ label: "STREAK", value: data.streak }] : []),
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "24px 32px",
                borderRadius: "8px",
                backgroundColor: s.label === "STREAK" ? "#1a2e1a" : "#141414",
                border: `2px solid ${s.label === "STREAK" ? "#00C853" : "#2A2A2A"}`,
                flex: 1,
              }}
            >
              <span style={{ fontSize: "16px", color: "#666", letterSpacing: "1px", marginBottom: "8px" }}>
                {s.label}
              </span>
              <span
                style={{
                  fontSize: "44px",
                  fontWeight: 700,
                  color: s.label === "STREAK" ? "#00C853" : "#FFFFFF",
                }}
              >
                {s.value.toLocaleString()}{s.label === "STREAK" ? "🔥" : ""}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
            paddingTop: "16px",
            borderTop: "1px solid #2A2A2A",
          }}
        >
          <span style={{ fontSize: "18px", color: "#666" }}>git-racer.com</span>
          <span style={{ fontSize: "18px", color: "#00C853" }}>Race your commits 🏎️</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

/**
 * Default site OG image — clean branded card with the pixel car.
 * Used for the generic site link preview (index.html og:image).
 */
export function renderDefaultOgImage(carImageUrl: string): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1A1A1A",
          fontFamily: "monospace",
        }}
      >
        {/* Car image */}
        <img
          src={carImageUrl}
          width="400"
          height="118"
          style={{ marginBottom: "40px", objectFit: "contain" }}
        />

        {/* Brand name */}
        <div style={{ fontSize: "42px", color: "#F0F0F0", fontWeight: 700, letterSpacing: "6px" }}>
          GIT RACER
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
