// Dette "kortet" er det grå feltet rundt et element mot den sorte bakgrunnen, brukes i friends
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-white dark:bg-[#1e2122] shadow-md rounded-xl p-6 ${className}`}>
      {children}
    </div>
  );
}
