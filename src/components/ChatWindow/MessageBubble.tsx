import { Check, CheckCheck } from "lucide-react";
import type { Message } from "../../types";

type Props = { message: Message };

export default function MessageBubble({ message }: Props) {
  const mine = message.fromMe;
  return (
    <div className={`flex w-full ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] px-3 pt-1.5 pb-1 rounded-lg shadow-lg backdrop-blur-md border
          ${mine
            ? "bg-white/10 border-white/15 rounded-tr-none"
            : "bg-black/40 border-white/10 rounded-tl-none"}`}
      >
        <p className="text-[14.5px] text-wa-text whitespace-pre-wrap wrap-break-word leading-snug">
          {message.text}
        </p>
        <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] text-wa-text/70">
          <span>{message.time}</span>
          {mine && (
            message.status === "read"
              ? <CheckCheck size={14} className="text-white" />
              : message.status === "delivered"
              ? <CheckCheck size={14} />
              : <Check size={14} />
          )}
        </div>
      </div>
    </div>
  );
}
