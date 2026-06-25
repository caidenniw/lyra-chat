import { Menu } from 'lucide-react';

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl hover:bg-bg-alt text-text-muted hover:text-text transition-colors"
        >
          <Menu size={18} />
        </button>
        <span className="text-sm font-semibold text-text-dim tracking-wide">Lyra</span>
      </div>
    </header>
  );
}
