import React from 'react';
import { cn } from '@/lib/utils';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ className, children, required, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'block text-sm font-medium text-gray-700 dark:text-gray-300',
        className
      )}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}
