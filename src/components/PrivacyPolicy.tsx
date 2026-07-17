// src/components/PrivacyPolicy.tsx — Privacy Policy page
import { X } from 'lucide-react';

interface PrivacyPolicyProps {
  onClose: () => void;
}

export function PrivacyPolicy({ onClose }: PrivacyPolicyProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
      <div className="bg-surface border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">Kebijakan Privasi</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-bg-alt transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5 text-sm text-text leading-relaxed max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-text-dim">Terakhir diperbarui: 17 Juli 2026</p>

          <section>
            <h3 className="font-semibold text-base mb-2">1. Informasi yang Kami Kumpulkan</h3>
            <p>Lyra AI menghormati privasi Anda. Kami hanya mengumpulkan data yang diperlukan untuk menjalankan layanan:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-text-dim">
              <li><strong>Akun (opsional):</strong> Jika Anda mendaftar, kami menyimpan alamat email Anda untuk autentikasi.</li>
              <li><strong>Percakapan:</strong> Riwayat chat Anda disimpan untuk memungkinkan fitur riwayat percakapan. Data ini tidak dibagikan ke pihak ketiga.</li>
              <li><strong>Data Penggunaan:</strong> Informasi anonim seperti waktu akses dan model yang digunakan untuk meningkatkan layanan.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">2. Cara Kami Menggunakan Data</h3>
            <ul className="list-disc list-inside space-y-1 text-text-dim">
              <li>Menjalankan dan memelihara layanan Lyra AI</li>
              <li>Menyediakan riwayat percakapan antar sesi (khusus pengguna terdaftar)</li>
              <li>Meningkatkan kualitas respons AI melalui evaluasi anonim</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">3. Penyimpanan Data</h3>
            <p className="text-text-dim">Data percakapan disimpan di server Supabase (Eropa/Amerika). Untuk pengguna Guest Mode, data hanya disimpan di memori lokal browser dan akan hilang setelah sesi berakhir atau browser ditutup.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">4. Berbagi Data dengan Pihak Ketiga</h3>
            <p className="text-text-dim">Lyra menggunakan <strong>OpenCode Zen API</strong> sebagai penyedia model AI. Saat Anda mengirim pesan, konten dikirim ke server OpenCode untuk diproses. OpenCode memiliki kebijakan zero-retention — data tidak disimpan atau digunakan untuk pelatihan model.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">5. Keamanan</h3>
            <p className="text-text-dim">Kami menggunakan enkripsi HTTPS untuk semua komunikasi. Autentikasi pengguna ditangani oleh Supabase dengan standar keamanan industri.</p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">6. Hak Anda</h3>
            <ul className="list-disc list-inside space-y-1 text-text-dim">
              <li>Anda dapat menghapus percakapan kapan saja melalui menu dropdown.</li>
              <li>Anda dapat meminta penghapusan akun dan seluruh data dengan menghubungi kami.</li>
              <li>Anda dapat menggunakan Lyra dalam Guest Mode tanpa memberikan data pribadi.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">7. Kontak</h3>
            <p className="text-text-dim">Untuk pertanyaan tentang privasi, hubungi: <a href="https://github.com/caidenniw" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/caidenniw</a></p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">8. Perubahan Kebijakan</h3>
            <p className="text-text-dim">Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan akan diumumkan melalui halaman ini.</p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-bg-alt/30">
          <button onClick={onClose} className="w-full py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
