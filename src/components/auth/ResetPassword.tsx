import React, { useState } from 'react';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { PageView } from '../../types';

interface ResetPasswordProps {
  onNavigate: (page: PageView) => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured()) {
      setSubmitted(true);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSubmitted(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 bg-[#FAF8F5]">
      <div className="w-full max-w-md bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs p-8 shadow-xs space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="font-serif text-2xl text-[#1C1917] font-normal">
            Choose New Password
          </h1>
          <p className="text-xs text-[#57534E]">
            Please enter your new secure password below.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                Your password has been successfully updated. You can now sign in with your new password.
              </span>
            </div>
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => onNavigate({ type: 'login' })}
            >
              Sign In to Your Account
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
                New Password * (min. 6 characters)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2.5 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                />
                <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#1C1917] mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
