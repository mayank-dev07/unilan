import { motion } from "framer-motion";

type Props = {
  text: string;
  className?: string;
  delay?: number;
};

export default function BlurText({ text, className, delay = 0 }: Props) {
  const letters = text.split("");
  return (
    <span className={className} aria-label={text}>
      {letters.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          initial={{ opacity: 0, filter: "blur(8px)", y: 4 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.35, delay: delay + i * 0.025, ease: "easeOut" }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
