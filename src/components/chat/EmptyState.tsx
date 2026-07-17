import { Article, Sparkle, Code, Translate } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import logoIcon from '../../assets/gambar2.png';

interface EmptyStateProps {
  onSend: (content: string) => void;
  user?: User | null;
}

const SAVED_PROMPTS = [
  {
    icon: Article,
    title: 'Ringkas Materi',
    description: 'Ubah catatan panjang atau PDF jadi poin-poin esensial yang siap dipelajari.',
    prompt: 'Ringkas catatan/materi berikut jadi poin-poin penting yang gampang dipahami dan dipelajari ulang.',
  },
  {
    icon: Sparkle,
    title: 'Ide Proyek',
    description: 'Dapatkan ide-ide segar dan actionable untuk tugas, proyek, atau konten kreator.',
    prompt: 'Bantu brainstorming 5 ide kreatif dan actionable untuk proyek atau tugas berikut.',
  },
  {
    icon: Code,
    title: 'Bantu Coding',
    description: 'Jelaskan kode, identifikasi error, atau bantu debug program kamu.',
    prompt: 'Jelaskan kode berikut langkah demi langkah, dan kalau ada bug tolong tunjukkan di mana.',
  },
  {
    icon: Translate,
    title: 'Translate Natural',
    description: 'Terjemahkan artikel, jurnal, atau teks ke bahasa Indonesia yang natural.',
    prompt: 'Terjemahkan teks berikut ke bahasa Indonesia dengan gaya yang natural, mudah dibaca, dan kontekstual.',
  },
];

export function EmptyState({ onSend, user }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-start md:justify-center px-4 pt-12 pb-24 md:py-16 overflow-y-auto min-h-0">
      <div className="w-full max-w-md md:max-w-2xl">
        {/* Greeting — bold & spacious */}
        <div className="text-center mb-6 md:mb-10">
          <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 animate-message-in">
            <img src={logoIcon} alt="Lyra" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text tracking-tight animate-message-in" style={{ animationDelay: '0.1s' }}>
            {(() => {
              const h = new Date().getHours();
              const time = h < 12 ? 'Selamat pagi' : h < 17 ? 'Selamat siang' : 'Selamat malam';
              return user ? `${time}, ${user.email?.split('@')[0]}` : time;
            })()}
          </h1>
          <p className="text-base md:text-lg text-text-muted mt-2 md:mt-3 animate-message-in" style={{ animationDelay: '0.15s' }}>
            Ada yang bisa saya bantu hari ini?
          </p>
        </div>

        {/* Prompt Cards — single column on mobile, 2 cols on desktop */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {SAVED_PROMPTS.map((item, i) => (
            <motion.button
              key={i}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSend(item.prompt)}
              className="flex items-start gap-3 p-4 md:p-5 rounded-2xl
                text-left group border border-border/40
                hover:bg-surface hover:border-border/60
                transition-colors duration-200"
            >
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full border border-border/60 flex-shrink-0 flex items-center justify-center bg-bg-alt/30">
                <item.icon size={18} weight="light" className="text-text-muted" />
              </div>
              <div className="min-w-0">
                <div className="text-sm md:text-base font-medium text-text tracking-tight">{item.title}</div>
                <div className="text-xs md:text-sm text-text-dim mt-1 leading-relaxed">{item.description}</div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
