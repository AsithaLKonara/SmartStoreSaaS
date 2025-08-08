declare module 'next/link' {
  import { ComponentType, ReactNode } from 'react';
  
  interface LinkProps {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
    locale?: string | false;
    className?: string;
    children: ReactNode;
    onClick?: () => void;
  }
  
  const Link: ComponentType<LinkProps>;
  export default Link;
}

declare module 'next/navigation' {
  export function useRouter(): {
    push: (url: string) => void;
    replace: (url: string) => void;
    back: () => void;
    forward: () => void;
    refresh: () => void;
    prefetch: (url: string) => Promise<void>;
  };
  
  export function useSearchParams(): {
    get: (key: string) => string | null;
    has: (key: string) => boolean;
    getAll: (key: string) => string[];
    keys: () => IterableIterator<string>;
    values: () => IterableIterator<string>;
    entries: () => IterableIterator<[string, string]>;
    forEach: (callbackfn: (value: string, key: string) => void) => void;
    toString: () => string;
  };
  
  export function usePathname(): string;
  
  export function redirect(url: string): never;
}
