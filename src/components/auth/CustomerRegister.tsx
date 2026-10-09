import React, { useState } from 'react';
import { Mail, Lock, User, Phone, MapPin, ArrowRight, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { PageView } from '../../types';
import { VKVastramLogo } from '../common/VKVastramLogo';

interface CustomerRegisterProps {
  onSuccess: (userId: string, email: string) => void;
  onNavigate: (page: PageView) => void;
  redirectAfter?: PageView;
}

export const CustomerRegister: React.FC<CustomerRegisterProps> = ({
  onSuccess,
  onNavigate,
  redirectAfter,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessInfo(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your password.');
      return;
    }
    if (pincode && !/^\d{6}$/.test(pincode.trim())) {
      setErrorMessage('Please enter a valid 6-digit Indian postal pincode.');
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured()) {
      const mockId = `cust-${Date.now()}`;
      onSuccess(mockId, email);
      onNavigate(redirectAfter || { type: 'account' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            city: city.trim(),
            pincode: pincode.trim(),
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setErrorMessage('An account with this email address already exists. Please sign in instead.');
        } else {
          setErrorMessage(error.message);
        }
        setLoading(false);
        return;
      }

      if (data.user) {
        // If session is immediately active
        if (data.session) {
          onSuccess(data.user.id, data.user.email || email);
          onNavigate(redirectAfter || { type: 'account' });
        } else {
          // Email verification requirement active in Supabase project
          setSuccessInfo(
            'Account created successfully! Please check your email to confirm your account, then sign in.'
          );
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-12 px-4 sm:px-6 bg-[#FAF8F5]">
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
            Client Registration
          </p>
          <VKVastramLogo variant="full" size="md" animate={true} />
          <p className="text-xs text-[#57534E] !mt-4">
            Save handloom selections, expedite checkout, and track your orders.
          </p>
        </div>

        {/* Success notification */}
        {successInfo ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successInfo}</span>
            </div>
            <Button
              variant="primary"
              fullWidth
              size="md"
              onClick={() => onNavigate({ type: 'login', redirectAfter })}
            >
              Proceed to Sign In
            </Button>
          </div>
        ) : (
          <>
            {/* Error notification */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-[#1C1917] mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Priyadarshini Rao"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                  />
                  <User className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1C1917] mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                  />
                  <Mail className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1C1917] mb-1">
                  Contact Phone (Optional)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                  />
                  <Phone className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-[#1C1917] mb-1">
                    City (Optional)
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Bengaluru"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-[#1C1917]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-[#1C1917] mb-1">
                    Pincode (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="560041"
                      className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs text-[#1C1917]"
                    />
                    <MapPin className="w-3.5 h-3.5 text-[#78716C] absolute right-2.5 top-2.5" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1C1917] mb-1">
                  Create Password * (min. 6 characters)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                  />
                  <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#1C1917] mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 pl-9 pr-3 py-2 rounded-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#B88E3E]"
                  />
                  <Lock className="w-4 h-4 text-[#78716C] absolute left-3 top-2.5" />
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
                {loading ? 'Creating Account...' : 'Register Account'}
              </Button>
            </form>

            <div className="pt-4 border-t border-[#1C1917]/10 text-center text-xs text-[#57534E]">
              <span>Already have an account? </span>
              <button
                onClick={() => onNavigate({ type: 'login', redirectAfter })}
                className="text-[#967029] font-medium hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
