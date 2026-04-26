import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode[];
  className?: string;
  itemDelay?: number;
};

export default function AnimatedList({ children, className, itemDelay = 0.04 }: Props) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: i * itemDelay, ease: "easeOut" }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
