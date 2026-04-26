import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string) => Promise<void>;
};

export default function NewChatDialog({ open, onClose, onSubmit }: Props) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(username.trim());
      setUsername("");
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-line rounded-md w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg">new chat</h2>
          <button onClick={onClose} className="text-ink-dim hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
            their username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. bob"
            autoFocus
            required
            minLength={3}
            className="bg-paper border border-line rounded-sm px-3 py-2 text-[14px] outline-none focus:border-line-strong"
          />
          {err && (
            <p className="text-[12px] text-red-500 border border-red-500/30 bg-red-500/5 rounded-sm px-3 py-2">
              {err}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="bg-accent text-accent-fg py-2 rounded-sm text-[12px] uppercase tracking-[0.2em] disabled:opacity-50"
          >
            {busy ? "..." : "start chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
