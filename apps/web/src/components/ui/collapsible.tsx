import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

type CollapsibleContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const CollapsibleContext = createContext<CollapsibleContextType | undefined>(
  undefined
);

const useCollapsible = () => {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error('useCollapsible must be used within a Collapsible');
  }
  return context;
};

type CollapsibleProps = {
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

export const Collapsible = ({
  children,
  defaultOpen = false,
  className,
}: CollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={cn('rounded-lg border', className)}>{children}</div>
    </CollapsibleContext.Provider>
  );
};

type CollapsibleTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

export const CollapsibleTrigger = ({
  children,
  className,
}: CollapsibleTriggerProps) => {
  const { isOpen, setIsOpen } = useCollapsible();

  return (
    <button
      className={cn(
        'flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
        className
      )}
      onClick={() => setIsOpen(!isOpen)}
      type="button"
    >
      <div className="flex items-center gap-2">{children}</div>
      <ChevronDown
        className={cn(
          'h-4 w-4 transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </button>
  );
};

type CollapsibleContentProps = {
  children: React.ReactNode;
  className?: string;
};

export const CollapsibleContent = ({
  children,
  className,
}: CollapsibleContentProps) => {
  const { isOpen } = useCollapsible();

  return (
    <div
      className={cn(
        'overflow-hidden transition-all duration-200',
        isOpen ? 'max-h-none' : 'max-h-0'
      )}
    >
      <div className={cn('border-t p-3 pt-0', className)}>{children}</div>
    </div>
  );
};
