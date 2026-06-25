import { motion, AnimatePresence } from 'framer-motion';
import { Wrench } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoIcon from '../../assets/gambar2.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  useAuth(); // keep hook call stable

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-sm mx-4 bg-surface rounded-3xl shadow-2xl border border-border overflow-hidden"
          >
            <div className="px-6 pt-10 pb-8 text-center">
              {/* Logo */}
              <img src={logoIcon} alt="Lyra" className="w-14 h-14 mx-auto mb-5 rounded-2xl object-contain" />

              {/* Maintenance icon */}
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Wrench size={22} className="text-amber-500" />
              </div>

              <h2 className="text-xl font-bold text-text mb-2">
                Sedang Dalam Perbaikan
              </h2>
              <p className="text-sm text-text-muted leading-relaxed mb-6">
                Fitur login dan pendaftaran akun sedang dalam pengembangan. Nantikan pembaruan selanjutnya.
              </p>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-bg-alt hover:bg-border transition-colors text-sm font-medium text-text"
              >
                Kembali
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
