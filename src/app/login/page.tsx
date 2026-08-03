'use client';
// SPDX-License-Identifier: MIT


import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Email hoặc mật khẩu không hợp lệ');
      } else {
        router.push(callbackUrl);
        router.refresh(); // Force reload to update session state in layouts
      }
    } catch (err) {
      setError('Đã xảy ra lỗi không mong muốn');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-[var(--primary)] opacity-[0.03] rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-[var(--primary)] opacity-[0.02] rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-[400px] z-10 animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-glow-primary">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Chào mừng đến với SafeSight AI
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Nhập thông tin để truy cập cổng giám sát
          </p>
        </div>

        <div className="glass-heavy rounded-2xl p-6 sm:p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--danger-muted)] text-[var(--danger)] text-sm border border-[var(--danger)]/20 animate-slide-in-right">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                Địa chỉ Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all outline-none"
                placeholder="admin@safesight.ai"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-[var(--text-secondary)]">
                  Mật khẩu
                </label>
                <a href="#" className="text-xs font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors">
                  Quên mật khẩu?
                </a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full py-2.5 rounded-lg font-medium text-white gradient-primary hover:shadow-glow-primary transition-all flex items-center justify-center gap-2",
                isLoading && "opacity-70 cursor-not-allowed hover:shadow-none"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Test credentials info */}
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-muted)] font-medium mb-1">Thông tin đăng nhập thử nghiệm:</p>
              <p className="text-xs font-mono text-[var(--text-secondary)]">admin@safesight.ai / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
