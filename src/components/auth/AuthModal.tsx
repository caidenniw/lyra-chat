import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logoIcon from '../../assets/gambar2.png';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthStep = 'email' | 'otp';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { sendOtp, verifyOtp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const { error: authError } = await sendOtp(email);
    
    if (authError) {
      setError(authError.message);
    } else {
      setStep('otp');
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const { error: authError } = await verifyOtp(email, otp);
    
    if (authError) {
      setError(authError.message);
    } else {
      onClose(); // Tutup modal jika sukses
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const { error: authError } = await signInWithGoogle();
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-surface rounded-[32px] shadow-2xl border border-border overflow-hidden"
          >
            <div className="px-8 py-10 flex flex-col items-center">
              <img src={logoIcon} alt="Lyra" className="w-12 h-12 mb-6 rounded-2xl object-contain" />
              
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-text mb-2">
                  {step === 'email' ? 'Selamat Datang' : 'Verifikasi OTP'}
                </h2>
                <p className="text-sm text-text-muted">
                  {step === 'email' 
                    ? 'Masuk ke Lyra Chat untuk memulai percakapan.' 
                    : `Kami telah mengirimkan kode ke ${email}`}
                </p>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="w-full p-3 mb-4 text-xs text-red-400 bg-red-400/10 rounded-xl border border-red-400/20 text-center"
                >
                  {error}
                </motion.div>
              )}

              <div className="w-full relative overflow-hidden h-[240px]">
                <AnimatePresence mode="wait">
                  {step === 'email' ? (
                    <motion.div
                      key="email-step"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                          <input
                            type="email"
                            required
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-bg-alt border border-border text-text placeholder:text-text-muted outline-none focus:border-primary transition-all"
                          />
                        </div>
                        <button
                          disabled={loading}
                          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? 'Mengirim...' : 'Kirim Kode OTP'}
                          {!loading && <LogIn size={16} />}
                        </button>
                      </form>

                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center"><span className="w-full h-px bg-border" /></div>
                        <div className="relative flex justify-center text-xs uppercase text-text-muted tracking-widest">
                          <span className="bg-surface px-2">Atau</span>
                        </div>
                      </div>

                      <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-white text-text border border-border hover:bg-gray-50 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm font-medium"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="otp-step"
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -20, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="relative">
                          <input
                            type="text"
                            required
                            maxLength={6}
                            placeholder="000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-bg-alt border border-border text-center text-xl tracking-[0.5em] font-mono text-text placeholder:text-text-muted outline-none focus:border-primary transition-all"
                          />
                        </div>
                        <button
                          disabled={loading}
                          className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep('email')}
                          className="w-full py-2 text-xs text-text-muted hover:text-text transition-colors flex items-center justify-center gap-1"
                        >
                          <ArrowLeft size={12} />
                          Ganti Email
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
