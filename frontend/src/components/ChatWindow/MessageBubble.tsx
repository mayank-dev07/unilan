import { useState } from "react";
import { Check, CheckCheck, Eye, EyeOff } from "lucide-react";
import type { Message } from "../../types";

type Props = { message: Message };

export default function MessageBubble({ message }: Props) {
  const mine = message.fromMe;
  const [revealed, setRevealed] = useState(false);

  // A media-only message has no meaningful text content. Hide the eye toggle.
  const hasMedia = !!message.mediaUrl;
  const hasMeaningfulText = !!(message.unilan && message.unilan.length > 0);
  // The eye toggle reveals the message rendered IN THE VIEWER'S LANGUAGE.
  // For sent messages that's the user's own text. For received messages
  // crossing languages, it's the translation into the viewer's language —
  // very useful for actually understanding the message.
  const revealedText = message.display ?? message.original ?? message.text;
  const canToggle = hasMeaningfulText && !!revealedText;
  const primary = revealed ? revealedText : (message.unilan ?? message.text);

  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[68%] ${hasMedia ? "p-1.5" : "px-3.5 py-2"} rounded-md border
          ${mine
            ? "bg-bubble-mine text-bubble-mine-fg border-bubble-mine"
            : "bg-bubble-theirs text-bubble-theirs-fg border-line"}`}
      >
        {hasMedia && message.mediaType === "image" && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <img
              src={message.mediaUrl}
              alt="shared image"
              loading="lazy"
              className="rounded-sm max-h-80 object-cover w-full"
            />
          </a>
        )}
        {hasMedia && message.mediaType === "video" && (
          <video
            src={message.mediaUrl}
            controls
            preload="metadata"
            className="rounded-sm max-h-80 w-full"
          />
        )}

        {hasMeaningfulText && (
          <p
            className={`text-[13.5px] whitespace-pre-wrap wrap-break-word leading-snug ${
              hasMedia ? "px-2 pt-1.5" : ""
            } ${!revealed && canToggle ? "font-mono tracking-wide" : ""}`}
          >
            {primary}
          </p>
        )}

        <div
          className={`flex items-center justify-end gap-1.5 ${hasMedia ? "px-2 pb-1 pt-1" : "mt-1"} text-[10px] uppercase tracking-[0.15em]
            ${mine ? "text-bubble-mine-fg/55" : "text-ink-dim"}`}
        >
          {canToggle && (
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="flex items-center gap-1 hover:opacity-100 opacity-70 transition"
              title={revealed ? "show UNI LAN" : "show original text"}
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
