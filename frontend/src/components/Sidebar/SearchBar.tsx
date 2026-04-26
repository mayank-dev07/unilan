import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className="px-3 py-3 bg-paper border-b border-line">
      <div className="flex items-center gap-3 bg-card border border-line rounded-md px-3 py-1.5 focus-within:border-line-strong transition">
        <Search size={14} className="text-ink-dim" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="search"
          className="flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-ink-dim outline-none py-1 tracking-wide lowercase"
        />
      </div>
    </div>
  );
}
