import { Link } from "react-router-dom";
import ignitionLogo from "@/assets/ignition-logo.png";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-[#111318] text-white shadow-sm">
      <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 group">
          <span className="flex h-12 items-center rounded-lg bg-white px-2 shadow-sm">
            <img src={ignitionLogo} alt="Ignition" className="h-9 w-auto max-w-[96px] object-contain" />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors">
            Ignition
          </span>
        </Link>
        <div className="hidden rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 sm:block">
          Football probability engine
        </div>
      </div>
    </header>
  );
}
