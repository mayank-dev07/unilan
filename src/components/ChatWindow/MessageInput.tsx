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
      className="flex items-center gap-2 px-3 py-2.5 bg-wa-panel-2/70 backdrop-blur-md border-t border-white/10"
    >
      <button type="button" className="p-2 text-wa-text-dim hover:text-wa-text transition">
        <Smile size={22} />
      </button>
      <button type="button" className="p-2 text-wa-text-dim hover:text-wa-text transition">
        <Paperclip size={22} />
      </button>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message"
        className="flex-1 bg-white/5 border border-white/10 text-wa-text placeholder:text-wa-text-dim text-[14.5px] rounded-lg px-4 py-2 outline-none focus:border-white/25 transition"
      />

      <button
        type="submit"
        className="p-2 text-wa-text-dim hover:text-white transition"
        title={hasText ? "Send" : "Record"}
      >
        {hasText ? <Send size={22} /> : <Mic size={22} />}
      </button>
    </form>
  );
}
