// components/common/Card.tsx
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}
