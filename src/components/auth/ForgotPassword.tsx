import React, { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { PageView } from '../../types';

interface ForgotPasswordProps {
  onNavigate: (page: PageView) => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    if (!isSupabaseConfigured()) {
      setSubmitted(true);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 bg-[#FAF8F5]">
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => onNavigate({ type: 'login' })}
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs p-8 shadow-xs space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="font-serif text-2xl text-[#1C1917] font-normal">
            Reset Your Password
          </h1>
          <p className="text-xs text-[#57534E]">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                If an account exists with <strong className="font-semibold">{email}</strong>, a password reset link has been dispatched to your inbox.
              </span>
            </div>
            <Button
              variant="secondary"
              fullWidth
              size="md"
              onClick={() => onNavigate({ type: 'login' })}
            >
              Return to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block font-medium text-[#1C1917] mb-1.5">
                Registered Email Address *
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

            <Button
              variant="primary"
              fullWidth
              size="md"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Sending Instructions...' : 'Send Reset Link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
