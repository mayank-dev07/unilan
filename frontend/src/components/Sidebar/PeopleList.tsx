import { useState } from "react";
import { useUsers } from "../../hooks/useUsers";

type Props = {
  onStartChat: (username: string) => Promise<void>;
};

function avatarFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const idx = (Math.abs(h) % 70) + 1;
  return `https://i.pravatar.cc/120?img=${idx}`;
}

export default function PeopleList({ onStartChat }: Props) {
  const { users, loading, error } = useUsers();
  const [busy, setBusy] = useState<string | null>(null);

  const click = async (username: string) => {
    setBusy(username);
    try {
      await onStartChat(username);
    } finally {
      setBusy(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <p className="text-center text-ink-dim text-[11px] tracking-[0.2em] uppercase py-12">
        loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-center text-red-500 text-[11px] tracking-[0.2em] uppercase py-12">
        {error}
      </p>
    );
  }
  if (users.length === 0) {
    return (
      <p className="text-center text-ink-dim text-[11px] tracking-[0.2em] uppercase py-12">
        no other users yet — invite a friend
      </p>
    );
  }

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          <button
            disabled={busy !== null}
            onClick={() => click(u.username)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-line hover:bg-card/60 disabled:opacity-60"
          >
            <img
              src={avatarFor(u.username)}
              alt={u.username}
              className="w-11 h-11 rounded-full object-cover ring-1 ring-line shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="font-serif text-[15px] text-ink truncate font-medium leading-tight">
                {u.username}
              </div>
              <div className="text-[11px] text-ink-dim tracking-wide lowercase">
                {busy === u.username ? "starting chat…" : "tap to start chat"}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
