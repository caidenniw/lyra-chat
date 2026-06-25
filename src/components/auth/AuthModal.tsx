import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, AlertCircle, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoIcon from '../../assets/gambar2.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = mode === 'login'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);

      if (authError) {
        // Terjemahkan error ke bahasa Indonesia yang user-friendly
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email atau password salah. Silakan coba lagi.');
        } else if (authError.message.includes('User already registered')) {
          setError('Email ini sudah terdaftar. Silakan login.');
        } else if (authError.message.includes('Password should be at least')) {
          setError('Password minimal 6 karakter.');
        } else {
          setError('Terjadi kesalahan. Silakan coba lagi.');
        }
      } else {
        if (mode === 'register') {
          setError('');
          alert('Registrasi berhasil! Silakan cek email kamu untuk verifikasi.');
        }
        onClose();
      }
    } catch {
      setError('Terjadi kesalahan jaringan. Periksa koneksi internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    const { error: authError } = await signInWithGoogle();
    if (authError) {
      setError('Gagal login dengan Google. Silakan coba lagi.');
      setLoading(false);
    }
    // Google OAuth akan redirect, jadi loading state tidak perlu direset
  };

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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md mx-4 bg-surface rounded-3xl shadow-2xl border border-border overflow-hidden"
          >
        {/* Header */}
        <div className="px-6 pt-8 pb-2 text-center">
          {/* Logo */}
          <img src={logoIcon} alt="Lyra" className="w-14 h-14 mx-auto mb-4 rounded-2xl object-contain" />

          <h2 className="text-xl font-bold text-text">
            {mode === 'login' ? 'Selamat datang kembali' : 'Buat akun baru'}
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {mode === 'login'
              ? 'Login untuk menyimpan chat & membuat Pustaka'
              : 'Daftar untuk mulai menggunakan Lyra'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-all duration-300 text-text font-medium text-sm btn-press disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Loading...' : 'Login dengan Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-text-dim">atau</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg border border-border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg border border-border text-text text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all duration-300 btn-press disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} />
                  Masuk
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Daftar
                </>
              )}
            </button>
          </form>

          {/* Toggle Login/Register */}
          <p className="text-center text-sm text-text-muted mt-5">
            {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-primary hover:text-primary-light font-medium transition-colors"
            >
              {mode === 'login' ? 'Daftar sekarang' : 'Masuk'}
            </button>
          </p>

          {/* Skip / Continue as Guest */}
          <button
            onClick={onClose}
            className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm text-text-dim hover:text-text-muted hover:bg-bg-alt transition-all duration-300"
          >
            Lanjutkan tanpa akun →
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
  </AnimatePresence>
  );
}
