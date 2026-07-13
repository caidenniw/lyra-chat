import { Globe, X } from 'lucide-react';

interface SandboxButtonProps {
  isActive: boolean;
  onToggle: () => void;
}

export function SandboxButton({ isActive, onToggle }: SandboxButtonProps) {
  return (
    <button
      onClick={onToggle}
      title={isActive ? 'Matikan mode website builder' : 'Aktifkan mode website builder'}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 btn-press ${
        isActive
          ? 'bg-primary text-white shadow-soft'
          : 'bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30'
      }`}
    >
      {isActive ? (
        <>
          <Globe size={14} />
          <span>Website Mode</span>
          <X size={12} className="opacity-60" />
        </>
      ) : (
        <>
          <Globe size={14} />
          <span>Buat Website</span>
        </>
      )}
    </button>
  );
}
