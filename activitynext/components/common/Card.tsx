// Dette "kortet" er det grå feltet rundt et element mot den sorte bakgrunnen, brukes i friends
import React, { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: CSSProperties; // 👈 legg til denne
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = "", onClick, style }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl ${className}`} 
        onClick={onClick}
        style={style} // 👈 bruk den her
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;