/**
 * GitHub API integration layer.
 *
 * Wraps both the GitHub GraphQL API (for contribution/commit data) and the
 * REST API (for user search/validation). `fetchBatchContributionDays`
 * constructs a single batched GraphQL query with aliased fragments to fetch
 * many users at once without hitting per-request overhead.
 */

import { env } from "../lib/env.js";

/** A single day from the GitHub contribution calendar. */
interface ContributionDay {
  date: string;
  contributionCount: number;
}

/** Shape of the full contributions GraphQL response. */
interface ContributionsResponse {
  data: {
    user: {
      contributionsCollection: {
        totalCommitContributions: number;
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

/**
 * GraphQL query to fetch the contribution calendar for a user within a date
 * range. Returns both `totalCommitContributions` (commits only) and
 * `totalContributions` (all contribution types) so we can compute the ratio.
 */
const CONTRIBUTIONS_QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
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

/** GraphQL query to list every year a user has had GitHub contributions. */
const YEARS_QUERY = `
  query($username: String!) {
    user(login: $username) {
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

/** Send a typed GraphQL request to the GitHub API and return the parsed JSON. */
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

/**
 * Fetch per-day commit counts for a single user within a date range.
 *
 * Queries the GitHub GraphQL API for the contribution calendar.
 *
 * @param username - GitHub login.
 * @param from - Start of the date range (inclusive).
 * @param to - End of the date range (inclusive).
 * @param token - Optional OAuth token; falls back to `GITHUB_APP_TOKEN`.
 * @returns Array of `{ date, count }` objects with commit-only counts.
 */
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

  const collection = data.data.user.contributionsCollection;
  const totalCommits = collection.totalCommitContributions;
  const totalContribs = collection.contributionCalendar.totalContributions;

  console.log(`[github] ${username}: totalCommits=${totalCommits} totalContribs=${totalContribs} from=${from.toISOString()} to=${to.toISOString()}`);

  // Flatten the nested weeks -> days structure into a simple list.
  const rawDays: { date: string; count: number }[] = [];
  for (const week of collection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      rawDays.push({ date: day.date, count: day.contributionCount });
    }
  }

  return rawDays;
}

/**
 * Retrieve the list of calendar years in which the user made any GitHub
 * contributions. Used to know which years need back-filling.
 *
 * @param username - GitHub login.
 * @param token - Optional OAuth token; falls back to `GITHUB_APP_TOKEN`.
 * @returns Array of four-digit year numbers (e.g. `[2020, 2021, 2022]`).
 */
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

/**
 * Validate that a GitHub user exists by hitting the REST API.
 *
 * @param username - GitHub login to look up.
 * @returns The user's `id`, canonical `login`, and `avatar_url`, or `null`
 *          if the user does not exist (HTTP 404).
 */
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

/**
 * Search GitHub users by a free-text query (autocomplete). Returns up to 8
 * results. Silently returns an empty array on API errors so the UI can
 * degrade gracefully.
 *
 * @param query - The search string (must be at least 2 characters).
 * @returns Matching users with `login`, `avatar_url`, and `id`.
 */
export async function searchGitHubUsers(
  query: string
): Promise<{ login: string; avatar_url: string; id: number }[]> {
  // Require a minimum query length to avoid overly broad searches.
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

/**
 * Fetch the most-followed GitHub users, paginating through the search API
 * until `count` results have been collected. Used to seed the suggested
 * opponents pool.
 *
 * @param count - Desired number of users (default 150). Capped by the GitHub
 *                search API's maximum of 1000 total results.
 * @returns Users sorted by follower count descending.
 */
export async function fetchTopGitHubUsers(
  count: number = 150
): Promise<{ login: string; avatar_url: string; followers: number }[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
  };
  if (env.GITHUB_APP_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_APP_TOKEN}`;
  }

  const accumulated: { login: string; avatar_url: string; followers: number }[] = [];
  // GitHub REST search allows at most 100 items per page.
  const perPage = Math.min(count, 100);
  const totalPages = Math.ceil(count / perPage);

  for (let page = 1; page <= totalPages; page++) {
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
    accumulated.push(...data.items.map((u) => ({
      login: u.login,
      avatar_url: u.avatar_url,
      followers: u.followers ?? 0,
    })));
  }

  return accumulated.slice(0, count);
}

/**
 * Batch-fetch per-day commit data for many users in as few API calls as
 * possible by packing multiple aliased `user(login: ...)` fragments into a
 * single GraphQL query.
 *
 * Users are processed in sequential batches of `batchSize` to stay under
 * GitHub's query-complexity limits. If a 403 or 429 response is received
 * (rate limit), processing stops early and the partial results are returned
 * alongside the count of users that were successfully fetched, so the caller
 * can resume from a cursor.
 *
 * @param usernames - GitHub logins to fetch contribution data for.
 * @param from - Start of the date range (inclusive).
 * @param to - End of the date range (inclusive).
 * @param batchSize - Max users per GraphQL request (default 25).
 * @returns `data` maps each username to its per-day commit counts;
 *          `processed` is the number of users successfully handled.
 */
export async function fetchBatchContributionDays(
  usernames: string[],
  from: Date,
  to: Date,
  batchSize: number = 25
): Promise<{ data: Map<string, { date: string; count: number }[]>; processed: number }> {
  const token = env.GITHUB_APP_TOKEN || "";
  if (!token) return { data: new Map(), processed: 0 };

  const resultsMap = new Map<string, { date: string; count: number }[]>();
  let processedCount = 0;

  for (let offset = 0; offset < usernames.length; offset += batchSize) {
    const batch = usernames.slice(offset, offset + batchSize);

    // Build a single GraphQL query with aliased fragments (u0, u1, u2, ...).
    // Each alias maps to one user's contribution data, letting us query up
    // to batchSize users in a single HTTP round-trip.
    const fragments = batch.map((username, idx) =>
      `u${idx}: user(login: "${username}") {
        contributionsCollection(from: "${from.toISOString()}", to: "${to.toISOString()}") {
          totalCommitContributions
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

      const responseBody = (await res.json()) as {
        data: Record<string, {
          contributionsCollection: {
            totalCommitContributions: number;
            contributionCalendar: {
              totalContributions: number;
              weeks: { contributionDays: ContributionDay[] }[];
            };
          };
        } | null>;
      };

      // Map each aliased response (u0, u1, ...) back to its username.
      batch.forEach((username, idx) => {
        const userData = responseBody.data?.[`u${idx}`];
        if (userData) {
          const collection = userData.contributionsCollection;
          const rawDays: { date: string; count: number }[] = [];
          for (const week of collection.contributionCalendar.weeks) {
            for (const day of week.contributionDays) {
              rawDays.push({ date: day.date, count: day.contributionCount });
            }
          }
          resultsMap.set(username, rawDays);
        }
      });

      processedCount = offset + batch.length;
    } catch {
      // Non-rate-limit errors (network, parse) -- skip this batch, try the next.
      continue;
    }
  }

  return { data: resultsMap, processed: processedCount };
}
