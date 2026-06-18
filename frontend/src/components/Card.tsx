import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

function Card({ children, title, subtitle, className = "" }: CardProps) {
  return (
    <div className={`surface-card rounded-2xl p-6 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          {title && (
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          )}
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export default Card;
