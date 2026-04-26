import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export default function SearchBar({ value, onChange }: Props) {
  return (
    <div className="px-3 py-2 bg-wa-panel">
      <div className="flex items-center gap-3 bg-wa-panel-2 rounded-lg px-4 py-1.5">
        <Search size={16} className="text-wa-text-dim" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search or start a new chat"
          className="flex-1 bg-transparent text-sm text-wa-text placeholder:text-wa-text-dim outline-none py-1"
        />
      </div>
    </div>
  );
}
