import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { PageView } from '../../types';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { VKVastramLogo } from '../common/VKVastramLogo';

interface CustomerLoginProps {
  onSuccess: (userId: string, email: string) => void;
  onNavigate: (page: PageView) => void;
  redirectAfter?: PageView;
}

export const CustomerLogin: React.FC<CustomerLoginProps> = ({
  onSuccess,
  onNavigate,
  redirectAfter,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    if (!isSupabaseConfigured()) {
      // Local development offline fallback
      const mockId = `cust-${Date.now()}`;
      onSuccess(mockId, email);
      onNavigate(redirectAfter || { type: 'account' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Incorrect email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('Please confirm your email address via the verification link sent to your inbox.');
        } else {
          setErrorMessage(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        onSuccess(data.user.id, data.user.email || email);
        onNavigate(redirectAfter || { type: 'account' });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network communication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 bg-[#FAF8F5]">
      {/* Back link */}
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => onNavigate({ type: 'home' })}
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Store</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs p-8 shadow-xs space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-[10px] uppercase font-semibold tracking-[0.2em] text-[#967029]">
            Client Access Portal
          </p>
          <VKVastramLogo variant="full" size="md" animate={true} />
          <p className="text-xs text-[#57534E] !mt-4">
            Sign in to access your curated bag, saved addresses, and orders.
          </p>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1C1917] mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2.5 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
              />
              <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-medium text-[#1C1917]">
                Password *
              </label>
              <button
                type="button"
                onClick={() => onNavigate({ type: 'forgot-password' })}
                className="text-[11px] text-[#967029] hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2.5 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
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
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>

        {/* Registration link */}
        <div className="pt-4 border-t border-[#1C1917]/10 text-center text-xs text-[#57534E]">
          <span>New to {storeName}? </span>
          <button
            onClick={() => onNavigate({ type: 'register', redirectAfter })}
            className="text-[#967029] font-medium hover:underline cursor-pointer"
          >
            Create an Account
          </button>
        </div>
      </div>
    </div>
  );
};
