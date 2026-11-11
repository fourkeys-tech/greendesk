import React from "react";

interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileContainer({ children, className = "" }: MobileContainerProps) {
  return (
    <div className={`md:hidden mx-auto max-w-md min-h-screen bg-[#F6F5F0] relative pb-24 shadow-2xl flex flex-col ${className}`}>
      {children}
    </div>
  );
}

