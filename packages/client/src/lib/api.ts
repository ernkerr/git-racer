const BASE = "/api";

// Simple stale-while-revalidate cache for GET requests.
// Returns cached data immediately on re-visit and refreshes in the background.
const cache = new Map<string, { data: unknown; ts: number }>();
const SWR_TTL = 30_000; // 30 seconds

async function fetchFresh<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as { error?: string }).error || res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const isGet = !options?.method || options.method === "GET";
  const cached = isGet ? cache.get(path) : undefined;

  // Return stale data instantly; revalidate in background
  if (cached && Date.now() - cached.ts < SWR_TTL) {
    fetchFresh<T>(path, options)
      .then((data) => cache.set(path, { data, ts: Date.now() }))
      .catch(() => {});
    return cached.data as T;
  }

  const data = await fetchFresh<T>(path, options);
  if (isGet) cache.set(path, { data, ts: Date.now() });
  return data;
}

/** Invalidate cached entries whose key starts with the given prefix. */
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
