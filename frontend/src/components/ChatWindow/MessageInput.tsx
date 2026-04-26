import { useState, type FormEvent } from "react";
import { Smile, Paperclip, Mic, Send } from "lucide-react";

type Props = {
  onSend: (text: string) => void;
};

export default function MessageInput({ onSend }: Props) {
  const [text, setText] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const hasText = text.trim().length > 0;

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 px-4 py-3 bg-card border-t border-line"
    >
      <button type="button" tabIndex={-1} className="p-2 text-ink-dim hover:text-ink transition">
        <Smile size={18} />
      </button>
      <button type="button" tabIndex={-1} className="p-2 text-ink-dim hover:text-ink transition">
        <Paperclip size={18} />
      </button>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="type a message"
        className="flex-1 bg-paper border border-line text-ink placeholder:text-ink-dim text-[13px] rounded-md px-3 py-2 outline-none focus:border-line-strong transition tracking-wide"
      />

      <button
        type="submit"
        className={`p-2 transition ${hasText ? "text-accent hover:text-ink" : "text-ink-dim hover:text-ink"}`}
        title={hasText ? "Send" : "Record"}
      >
        {hasText ? <Send size={18} /> : <Mic size={18} />}
      </button>
    </form>
  );
}
