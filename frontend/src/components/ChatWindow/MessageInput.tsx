import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Smile, Paperclip, Mic, Send, Loader2 } from "lucide-react";
import { ApiError, api } from "../../api/client";

type Props = {
  onSend: (text: string, media?: { url: string; type: "image" | "video" }) => void;
  onTyping?: (typing: boolean) => void;
};

const TYPING_IDLE_MS = 2500;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

export default function MessageInput({ onSend, onTyping }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (isTypingRef.current && onTyping) onTyping(false);
      isTypingRef.current = false;
    };
  }, [onTyping]);

  const handleChange = (val: string) => {
    setText(val);
    if (!onTyping) return;
    if (val.length > 0) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        onTyping(true);
      }
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          onTyping(false);
        }
      }, TYPING_IDLE_MS);
    } else {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTyping(false);
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (isTypingRef.current && onTyping) {
      isTypingRef.current = false;
      onTyping(false);
    }
  };

  // Paperclip → upload → send-as-its-own-message. No caption for now; user
  // can follow up with a text message.
  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!f) return;
    if (f.size > MAX_MEDIA_BYTES) {
      setUploadError("file too large (max 50MB)");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const r = await api.uploadMedia(f);
      onSend("", { url: r.url, type: r.type });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="bg-card border-t border-line">
      {uploadError && (
        <div className="px-4 pt-2 text-[11px] text-red-500 flex items-center justify-between gap-2">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2 px-4 py-3">
        <button type="button" tabIndex={-1} className="p-2 text-ink-dim hover:text-ink transition">
          <Smile size={18} />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 text-ink-dim hover:text-ink transition disabled:opacity-50"
          title="Attach image or video"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onPickFile}
        />

        <input
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={uploading ? "uploading…" : "type a message"}
          disabled={uploading}
          className="flex-1 bg-paper border border-line text-ink placeholder:text-ink-dim text-[13px] rounded-md px-3 py-2 outline-none focus:border-line-strong transition tracking-wide disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={uploading}
          className={`p-2 transition disabled:opacity-50 ${hasText ? "text-accent hover:text-ink" : "text-ink-dim hover:text-ink"}`}
          title={hasText ? "Send" : "Record"}
        >
          {hasText ? <Send size={18} /> : <Mic size={18} />}
        </button>
      </form>
    </div>
  );
}
