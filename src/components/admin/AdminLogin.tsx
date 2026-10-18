import React, { useState } from 'react';
import { Lock, Mail, ArrowLeft, ShieldAlert, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { authService, AdminUser } from '../../services/authService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { VKVastramLogo } from '../common/VKVastramLogo';

interface AdminLoginProps {
  onSuccess: (user: AdminUser) => void;
  onBackToStore: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onBackToStore }) => {
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await authService.signIn(email, password);
      if (result.success && result.user) {
        onSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network communication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Back to store navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          onClick={onBackToStore}
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Storefront</span>
        </button>
        <span className="text-[10px] uppercase tracking-wider text-[#967029] font-medium">
          Authorized Access Only
        </span>
      </div>

      <div className="w-full max-w-md bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs p-8 shadow-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#1C1917] text-[#FAF8F5] flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#B88E3E]" />
          </div>
          <VKVastramLogo variant="full" size="md" animate={true} />
          <p className="text-xs text-[#57534E] !mt-4">
            Store Control Center & CMS Portal
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1C1917] mb-1.5">
              Administrator Email
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vkvastram.com"
                className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 pl-9 pr-3 py-2.5 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
              />
              <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#1C1917] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#FAF8F5] border border-[#1C1917]/20 pl-9 pr-3 py-2.5 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
              />
              <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-3" />
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            size="md"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In to Control Center'}
          </Button>
        </form>

        {/* Helper Note for first-time or local test access */}
        <div className="pt-4 border-t border-[#1C1917]/10 text-[11px] text-[#78716C] space-y-1.5">
          <div className="flex items-start gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-[#967029] shrink-0 mt-0.5" />
            <div>
              {isSupabaseConfigured() ? (
                <p>
                  Connected to Supabase. Sign in with your registered administrator account.
                </p>
              ) : import.meta.env.PROD ? (
                <p>Administrator sign-in is disabled until production Supabase configuration is provided.</p>
              ) : (
                <p>Administrator sign-in requires Supabase configuration. No built-in test credentials are enabled.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
