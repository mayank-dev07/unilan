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
    <div className="flex-1 overflow-y-auto wa-scroll px-4 md:px-12 py-4">
      <div className="flex justify-center mb-4">
        <span className="text-[11px] bg-white/5 backdrop-blur-md text-wa-text/80 px-3 py-1 rounded-md border border-white/10">
          TODAY
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
