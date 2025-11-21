import React from 'react';
import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  description?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export function Switch({ className, label, description, onCheckedChange, checked, ...props }: SwitchProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCheckedChange) {
      onCheckedChange(e.target.checked);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          {...props}
        />
        <div
          className={cn(
            'w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors duration-200 ease-in-out',
            checked && 'bg-primary-500',
            className
          )}
        >
          <div
            className={cn(
              'w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ease-in-out',
              checked && 'translate-x-5'
            )}
          />
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
