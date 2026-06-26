import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  sendOtp: (email: string) => Promise<{ error: AuthError | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Ambil sesi awal
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Dengarkan perubahan auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Mengirim kode OTP ke email user.
   * Supabase akan mengirimkan email berisi kode 6-digit.
   */
  const sendOtp = async (email: string) => {
    if (!supabase) return { error: { message: 'Supabase belum dikonfigurasi.' } as AuthError };
    
    const { error } = await supabase.auth.signInWithOtp({ email });
    
    return { error };
  };

  /**
   * Memverifikasi kode OTP yang dimasukkan user.
   * Jika valid, user akan otomatis mendapatkan session login.
   */
  const verifyOtp = async (email: string, token: string) => {
    if (!supabase) return { error: { message: 'Supabase belum dikonfigurasi.' } as AuthError };
    
    const { error } = await supabase.auth.verifyOtp({ 
      email, 
      token, 
      type: 'email' // Menggunakan tipe verifikasi email/OTP
    });
    
    return { error };
  };

  const signInWithGoogle = async () => {
    if (!supabase) return { error: { message: 'Supabase belum dikonfigurasi.' } as AuthError };
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    return { error };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, sendOtp, verifyOtp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
