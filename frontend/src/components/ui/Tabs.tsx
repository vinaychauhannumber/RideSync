import React, { createContext, useContext, useState } from "react";
import { cn } from "../../lib/utils";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export const Tabs: React.FC<{
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ defaultValue, value, onValueChange, children, className }) => {
  const [localActiveTab, setLocalActiveTab] = useState(defaultValue);
  const activeTab = value !== undefined ? value : localActiveTab;
  
  const setActiveTab = (val: string) => {
    if (value === undefined) {
      setLocalActiveTab(val);
    }
    if (onValueChange) {
      onValueChange(val);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500 w-full md:w-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const TabsTrigger: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-slate-600 hover:text-slate-900",
        {
          "bg-white text-slate-950 shadow-sm shadow-slate-200/50": isActive,
        },
        className
      )}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<{
  value: string;
  children: React.ReactNode;
  className?: string;
}> = ({ value, children, className }) => {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  const isActive = context.activeTab === value;

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 animate-fade-in",
        className
      )}
    >
      {children}
    </div>
  );
};
