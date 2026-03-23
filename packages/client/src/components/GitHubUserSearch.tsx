import { useState, useEffect, useRef } from "react";
import { api } from "../lib/api.ts";

interface GitHubUser {
  login: string;
  avatar_url: string;
  id: number;
}

interface Props {
  value: string;
  onChange: (username: string) => void;
  placeholder?: string;
}

export default function GitHubUserSearch({ value, onChange, placeholder = "Search GitHub users..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GitHubUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api<GitHubUser[]>(`/github/search?q=${encodeURIComponent(q)}`);
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    search(val);
  };

  const selectUser = (user: GitHubUser) => {
    setQuery(user.login);
    onChange(user.login);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="input-arcade w-full px-3 py-2"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-arcade-gray border-t-arcade-cyan animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="retro-box absolute z-50 mt-1 w-full bg-arcade-surface overflow-hidden max-h-64 overflow-y-auto">
          {results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-arcade-bg transition-colors text-left"
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-8 h-8 rounded-none border-2 border-black shrink-0"
              />
              <span className="font-mono text-sm text-arcade-white truncate">{user.login}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
