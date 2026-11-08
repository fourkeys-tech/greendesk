import React from "react";

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileContainer({ children, className = "" }: MobileContainerProps) {
  return (
    <div className={`mx-auto max-w-md min-h-screen bg-slate-50 relative pb-24 shadow-2xl flex flex-col ${className}`}>
      {children}
    </div>
  );
}

