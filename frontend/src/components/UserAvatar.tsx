import { useState } from "react";

type Props = {
  name: string;
  url?: string | null;
  // Tailwind sizing class set, e.g. "w-9 h-9"
  size?: string;
  // Tailwind text size for the fallback letter, e.g. "text-[15px]"
  textSize?: string;
  online?: boolean;
};

// Stable hue derived from the name so each user gets a consistent color
// across renders / sessions. HSL keeps saturation+lightness friendly.
function hueFor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export default function UserAvatar({
  name,
  url,
  size = "w-9 h-9",
  textSize = "text-[15px]",
  online,
}: Props) {
  const [broken, setBroken] = useState(false);
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const showImg = !!url && !broken;

  return (
    <div className="relative shrink-0">
      {showImg ? (
        <img
          src={url!}
          alt={name}
          onError={() => setBroken(true)}
          className={`${size} rounded-full object-cover ring-1 ring-line`}
        />
      ) : (
        <div
          className={`${size} ${textSize} rounded-full ring-1 ring-line flex items-center justify-center font-serif font-medium text-white select-none`}
          style={{ background: `hsl(${hueFor(name)}, 55%, 45%)` }}
          aria-label={name}
        >
          {initial}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-accent rounded-full ring-2 ring-paper" />
      )}
    </div>
  );
}
