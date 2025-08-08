/// <reference types="react" />
/// <reference types="react-dom" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
      span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
      h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
      p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
      form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
      input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
      label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
      button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
      svg: React.SVGProps<SVGSVGElement>;
      path: React.SVGProps<SVGPathElement>;
      rect: React.SVGProps<SVGRectElement>;
      circle: React.SVGProps<SVGCircleElement>;
      line: React.SVGProps<SVGLineElement>;
      polyline: React.SVGProps<SVGPolylineElement>;
      a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
    }
  }
}

declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';
  
  type LucideIcon = FC<SVGProps<SVGSVGElement>>;
  
  export const Bot: LucideIcon;
  export const Mail: LucideIcon;
  export const Lock: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Search: LucideIcon;
  export const Filter: LucideIcon;
  export const X: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Plus: LucideIcon;
  export const Edit: LucideIcon;
  export const Trash: LucideIcon;
  export const Settings: LucideIcon;
  export const User: LucideIcon;
  export const LogOut: LucideIcon;
  export const Home: LucideIcon;
  export const BarChart: LucideIcon;
  export const ShoppingCart: LucideIcon;
  export const Package: LucideIcon;
  export const Users: LucideIcon;
  export const Truck: LucideIcon;
  export const CreditCard: LucideIcon;
  export const DollarSign: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const AlertCircle: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Info: LucideIcon;
  export const Warning: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const Calendar: LucideIcon;
  export const Clock: LucideIcon;
  export const MapPin: LucideIcon;
  export const Phone: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Globe: LucideIcon;
  export const Menu: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Loader: LucideIcon;
  export const Loader2: LucideIcon;
  export const Download: LucideIcon;
  export const Upload: LucideIcon;
  export const Copy: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Link: LucideIcon;
  export const Share: LucideIcon;
  export const Heart: LucideIcon;
  export const Star: LucideIcon;
  export const ThumbsUp: LucideIcon;
  export const ThumbsDown: LucideIcon;
  export const Bookmark: LucideIcon;
  export const Archive: LucideIcon;
  export const File: LucideIcon;
  export const FileText: LucideIcon;
  export const Folder: LucideIcon;
  export const Image: LucideIcon;
  export const Camera: LucideIcon;
  export const Video: LucideIcon;
  export const VideoOff: LucideIcon;
  export const Mic: LucideIcon;
  export const MicOff: LucideIcon;
  export const Volume: LucideIcon;
  export const VolumeX: LucideIcon;
  export const Volume1: LucideIcon;
  export const Volume2: LucideIcon;
  export const Wifi: LucideIcon;
  export const Battery: LucideIcon;
}

export {};
