import { env } from "../lib/env.js";

interface ContributionDay {
  date: string;
  contributionCount: number;
}

interface ContributionsResponse {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: number;
          weeks: {
            contributionDays: ContributionDay[];
          }[];
        };
      };
      contributionsYears?: number[];
    } | null;
  };
}

const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const YEARS_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

async function graphql<T>(query: string, variables: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchContributionDays(
  username: string,
  from: Date,
  to: Date,
  token?: string
): Promise<{ date: string; count: number }[]> {
  const authToken = token || env.GITHUB_APP_TOKEN || "";
  if (!authToken) throw new Error("No GitHub token available");

  const data = await graphql<ContributionsResponse>(
    CONTRIBUTIONS_QUERY,
    {
      username,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    authToken
  );

  if (!data.data.user) {
    throw new Error(`GitHub user "${username}" not found`);
  }

  const days: { date: string; count: number }[] = [];
  for (const week of data.data.user.contributionsCollection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      days.push({ date: day.date, count: day.contributionCount });
    }
  }
  return days;
}

export async function fetchContributionYears(
  username: string,
  token?: string
): Promise<number[]> {
  const authToken = token || env.GITHUB_APP_TOKEN || "";
  if (!authToken) throw new Error("No GitHub token available");

  const data = await graphql<{
    data: {
      user: { contributionsCollection: { contributionYears: number[] } } | null;
    };
  }>(YEARS_QUERY, { username }, authToken);

  if (!data.data.user) {
    throw new Error(`GitHub user "${username}" not found`);
  }

  return data.data.user.contributionsCollection.contributionYears;
}

export async function validateGitHubUser(
  username: string
): Promise<{ id: number; login: string; avatar_url: string } | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_APP_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_APP_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers,
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

  return res.json() as Promise<{ id: number; login: string; avatar_url: string }>;
}

export async function searchGitHubUsers(
  query: string
): Promise<{ login: string; avatar_url: string; id: number }[]> {
  if (!query || query.length < 2) return [];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_APP_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_APP_TOKEN}`;
  }

  const params = new URLSearchParams({
    q: `${query} type:user`,
    per_page: "8",
  });

  const res = await fetch(`https://api.github.com/search/users?${params}`, { headers });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    items: { login: string; avatar_url: string; id: number }[];
  };

  return data.items.map((u) => ({
    login: u.login,
    avatar_url: u.avatar_url,
    id: u.id,
  }));
}

export async function fetchTopGitHubUsers(
  count: number = 150
): Promise<{ login: string; avatar_url: string; followers: number }[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_APP_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_APP_TOKEN}`;
  }

  const result: { login: string; avatar_url: string; followers: number }[] = [];
  const perPage = Math.min(count, 100);
  const pages = Math.ceil(count / perPage);

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      q: "followers:>1000 type:user",
      sort: "followers",
      order: "desc",
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetch(`https://api.github.com/search/users?${params}`, { headers });
    if (!res.ok) break;

    const data = (await res.json()) as {
      items: { login: string; avatar_url: string; followers: number }[];
    };
    result.push(...data.items.map((u) => ({
      login: u.login,
      avatar_url: u.avatar_url,
      followers: u.followers ?? 0,
    })));
  }

  return result.slice(0, count);
}

/**
 * Batch-fetch day-by-day contribution data for multiple users.
 * Processes batches sequentially to avoid rate limits. Stops early on 403/429.
 * Returns the data map and the number of users successfully processed (for cursor tracking).
 */
export async function fetchBatchContributionDays(
  usernames: string[],
  from: Date,
  to: Date,
  batchSize: number = 25
): Promise<{ data: Map<string, { date: string; count: number }[]>; processed: number }> {
  const token = env.GITHUB_APP_TOKEN || "";
  if (!token) return { data: new Map(), processed: 0 };

  const results = new Map<string, { date: string; count: number }[]>();
  let processed = 0;

  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);

    const fragments = batch.map((username, idx) =>
      `u${idx}: user(login: "${username}") {
        contributionsCollection(from: "${from.toISOString()}", to: "${to.toISOString()}") {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }`
    );

    const query = `query { ${fragments.join("\n")} }`;

    try {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (res.status === 403 || res.status === 429) {
        break; // Rate limited — return what we have so far
      }

      if (!res.ok) continue;

      const data = (await res.json()) as {
        data: Record<string, {
          contributionsCollection: {
            contributionCalendar: {
              weeks: { contributionDays: ContributionDay[] }[];
            };
          };
        } | null>;
      };

      batch.forEach((username, idx) => {
        const userData = data.data?.[`u${idx}`];
        if (userData) {
          const days: { date: string; count: number }[] = [];
          for (const week of userData.contributionsCollection.contributionCalendar.weeks) {
            for (const day of week.contributionDays) {
              days.push({ date: day.date, count: day.contributionCount });
            }
          }
          results.set(username, days);
        }
      });

      processed = i + batch.length;
    } catch {
      continue;
    }
  }

  return { data: results, processed };
}
