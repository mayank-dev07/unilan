import { useEffect, useRef } from "react";
import type { Message } from "../../types";
import MessageBubble from "./MessageBubble";

type Props = { messages: Message[] };

export default function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto thin-scroll px-6 md:px-16 py-6">
      <div className="flex justify-center mb-6">
        <span className="text-[10px] tracking-[0.25em] uppercase text-ink-dim border border-line bg-card px-3 py-1 rounded-sm">
          today
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
