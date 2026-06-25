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
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        {/* Greeting */}
        <div className="mb-6 md:mb-8">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-light mx-auto mb-3 md:mb-5 flex items-center justify-center shadow-card animate-message-in">
            <Sparkles size={20} className="text-white md:hidden" />
            <Sparkles size={28} className="text-white hidden md:block" />
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-text mb-1 md:mb-2 animate-message-in" style={{ animationDelay: '0.1s' }}>
            Halo, Deni Arya 👋
          </h1>
          <p className="text-text-muted text-xs md:text-base animate-message-in" style={{ animationDelay: '0.15s' }}>
            Ada yang bisa saya bantu hari ini?
          </p>
        </div>

        {/* Saved Prompts */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <span className="text-xs md:text-sm font-medium text-text-muted">✨ Prompt tersimpan</span>
            <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary transition-colors btn-press">
              <Paperclip size={12} />
              <span>Lampirkan file</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3">
            {SAVED_PROMPTS.map((item, i) => (
              <button
                key={i}
                onClick={() => onSend(item.prompt)}
                className="card-hover flex flex-col items-start p-3 md:p-4 rounded-xl md:rounded-2xl bg-surface border border-border
                  hover:border-primary/20 text-left group animate-message-in"
                style={{ animationDelay: `${0.2 + i * 0.05}s` }}
              >
                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl ${item.color} flex items-center justify-center mb-2 md:mb-3 transition-transform duration-200 group-hover:scale-110`}>
                  <item.icon size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <div className="text-xs md:text-sm font-medium text-text mb-0.5 md:mb-1">{item.title}</div>
                <div className="text-[11px] md:text-xs text-text-muted leading-relaxed">{item.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
