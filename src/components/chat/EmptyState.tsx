import { Sparkles, Clock, Lightbulb, CheckSquare, Paperclip } from 'lucide-react';

interface EmptyStateProps {
  onSend: (content: string) => void;
}

const SAVED_PROMPTS = [
  {
    icon: Clock,
    title: 'Ringkas Meeting Notes',
    description: 'Ubah catatan meeting jadi 5 poin penting untuk tim.',
    prompt: 'Tolong ringkas catatan meeting ini menjadi 5 poin penting yang bisa dishare ke tim.',
    color: 'bg-blue-50 text-blue-500',
  },
  {
    icon: Lightbulb,
    title: 'Brainstorming Ide',
    description: 'Generate 3 ide kreatif untuk proyek baru.',
    prompt: 'Tolong bantu brainstorm 3 ide kreatif untuk proyek web app yang inovatif.',
    color: 'bg-amber-50 text-amber-500',
  },
  {
    icon: CheckSquare,
    title: 'Review Kode',
    description: 'Analisis kode dan temukan potensi bug.',
    prompt: 'Tolong review kode ini, temukan potensi bug dan berikan saran perbaikan.',
    color: 'bg-green-50 text-green-500',
  },
];

export function EmptyState({ onSend }: EmptyStateProps) {
  return (
    <div className="md:flex-1 flex items-start md:items-center justify-center px-3 md:px-4 pt-6 md:pt-4 pb-2 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Greeting — compact on mobile */}
        <div className="text-center mb-4 md:mb-8">
          <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary to-primary-light mx-auto mb-2 md:mb-5 flex items-center justify-center shadow-card animate-message-in">
            <Sparkles size={18} className="text-white md:hidden" />
            <Sparkles size={28} className="text-white hidden md:block" />
          </div>
          <h1 className="text-lg md:text-3xl font-bold text-text mb-0.5 md:mb-2 animate-message-in" style={{ animationDelay: '0.1s' }}>
            Halo, Deni Arya 👋
          </h1>
          <p className="text-text-muted text-[11px] md:text-base animate-message-in" style={{ animationDelay: '0.15s' }}>
            Ada yang bisa saya bantu hari ini?
          </p>
        </div>

        {/* Saved Prompts header — hidden on very small screens */}
        <div className="hidden md:flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text-muted">✨ Prompt tersimpan</span>
          <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors btn-press">
            <Paperclip size={12} />
            <span>Lampirkan file</span>
          </button>
        </div>

        {/* Cards — horizontal rows on mobile, 3-col grid on desktop */}
        <div className="flex flex-col gap-1.5 md:gap-3 md:grid md:grid-cols-3">
          {SAVED_PROMPTS.map((item, i) => (
            <button
              key={i}
              onClick={() => onSend(item.prompt)}
              className="card-hover flex items-center gap-3 p-2.5 md:p-4 rounded-xl md:rounded-2xl bg-surface border border-border
                hover:border-primary/20 text-left group animate-message-in"
              style={{ animationDelay: `${0.2 + i * 0.05}s` }}
            >
              <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl ${item.color} flex-shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <item.icon size={16} className="md:w-[18px] md:h-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs md:text-sm font-medium text-text truncate">{item.title}</div>
                <div className="text-[10px] md:text-xs text-text-muted leading-tight truncate">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
