import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { LanguageInfo } from "../api/types";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
};

// Lightweight in-memory cache so multiple instances of this dropdown share
// one network call. The list is small (~30) and effectively static.
let cachedLanguages: LanguageInfo[] | null = null;

export default function LanguageSelect({ value, onChange, disabled, className }: Props) {
  const [langs, setLangs] = useState<LanguageInfo[]>(cachedLanguages ?? []);
  const [loading, setLoading] = useState(!cachedLanguages);

  useEffect(() => {
    if (cachedLanguages) return;
    let alive = true;
    api.listLanguages()
      .then((r) => {
        if (!alive) return;
        cachedLanguages = r;
        setLangs(r);
      })
      .catch(() => { /* fall back to whatever we have */ })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={
        className ??
        "bg-paper/30 backdrop-blur-sm border border-line text-ink text-[14px] rounded-sm px-3 py-2 outline-none focus:border-line-strong w-full"
      }
    >
      {loading && <option>loading…</option>}
      {!loading && langs.length === 0 && <option value="en">English</option>}
      {langs.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
