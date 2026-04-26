import { useState } from "react";
import { Check, CheckCheck, Eye, EyeOff } from "lucide-react";
import type { Message } from "../../types";

type Props = { message: Message };

export default function MessageBubble({ message }: Props) {
  const mine = message.fromMe;
  const [revealed, setRevealed] = useState(false);
  const hasTranslation = !!(message.unilan && message.english);
  const primary = revealed
    ? (mine ? message.original ?? message.text : message.english ?? message.text)
    : (message.unilan ?? message.text);

  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[68%] px-3.5 py-2 rounded-md border
          ${mine
            ? "bg-bubble-mine text-bubble-mine-fg border-bubble-mine"
            : "bg-bubble-theirs text-bubble-theirs-fg border-line"}`}
      >
        <p
          className={`text-[13.5px] whitespace-pre-wrap wrap-break-word leading-snug ${
            !revealed && hasTranslation ? "font-mono tracking-wide" : ""
          }`}
        >
          {primary}
        </p>
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] uppercase tracking-[0.15em]
            ${mine ? "text-bubble-mine-fg/55" : "text-ink-dim"}`}
        >
          {hasTranslation && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="flex items-center gap-1 hover:opacity-100 opacity-70 transition"
              title={revealed ? "show UNI LAN" : (mine ? "show original" : "show English")}
            >
              {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
            </button>
          )}
          <span>{message.time}</span>
          {mine && (
            message.status === "read"
              ? <CheckCheck size={12} className="text-accent" />
              : message.status === "delivered"
              ? <CheckCheck size={12} />
              : <Check size={12} />
          )}
        </div>
      </div>
    </div>
  );
}
