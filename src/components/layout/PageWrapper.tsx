import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

export function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className={`w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
