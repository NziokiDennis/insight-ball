import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className={`w-full px-2 sm:px-4 lg:px-5 py-4 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
