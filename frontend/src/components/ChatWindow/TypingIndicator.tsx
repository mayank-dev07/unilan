type Props = { usernames: string[] };

// Three-dot animated indicator. When more than one person is typing we still
// show a single bubble — the label disambiguates.
export default function TypingIndicator({ usernames }: Props) {
  if (usernames.length === 0) return null;

  const label =
    usernames.length === 1
      ? `${usernames[0]} is typing`
      : usernames.length === 2
      ? `${usernames[0]} and ${usernames[1]} are typing`
      : `${usernames.length} people are typing`;

  return (
    <div className="flex w-full justify-start px-6 md:px-16 pb-2">
      <div className="bg-bubble-theirs border border-line rounded-md px-3 py-2 flex items-center gap-2">
        <span className="flex gap-1">
          <span className="dot" />
          <span className="dot" style={{ animationDelay: "0.15s" }} />
          <span className="dot" style={{ animationDelay: "0.3s" }} />
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">
          {label}
        </span>
      </div>
      <style>{`
        .dot {
          width: 6px;
          height: 6px;
          background: var(--color-ink-dim, #9aa0a6);
          border-radius: 9999px;
          display: inline-block;
          animation: typing-bounce 1s infinite ease-in-out;
        }
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
