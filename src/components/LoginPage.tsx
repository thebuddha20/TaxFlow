import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Building2,
  Phone,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Briefcase,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { User, UserRole, Firm } from '../types.ts';

interface LoginPageProps {
  onLoginSuccess: (token: string, user: User, firm?: Firm | null) => void;
  initialError?: string | null;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, initialError }) => {
  const [view, setView] = useState<'LOGIN' | 'SIGNUP' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD'>('LOGIN');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Signup fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [firmName, setFirmName] = useState('');
  const [role, setRole] = useState<UserRole>('FIRM_OWNER');

  // Reset fields
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>(initialError || '');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    if (initialError) {
      setErrorMessage(initialError);
    }
  }, [initialError]);

  // Load remembered email if previously stored
  useEffect(() => {
    const savedEmail = localStorage.getItem('taxflow_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Invalid email or password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 403) {
          throw new Error('Your account is inactive.');
        } else if (res.status === 401) {
          throw new Error('Invalid email or password.');
        } else if (res.status === 400) {
          throw new Error(data.message || 'Email and password are required.');
        } else {
          throw new Error(data.message || 'Invalid email or password.');
        }
      }

      // Remember me handling
      if (rememberMe) {
        localStorage.setItem('taxflow_remembered_email', trimmedEmail);
        localStorage.setItem('taxflow_auth_token', data.token);
      } else {
        localStorage.removeItem('taxflow_remembered_email');
        localStorage.removeItem('taxflow_auth_token');
        sessionStorage.setItem('taxflow_auth_token', data.token);
      }

      onLoginSuccess(data.token, data.user, data.firm);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          role,
          firmName: firmName.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error creating account. Please try again.');
      }

      if (rememberMe) {
        localStorage.setItem('taxflow_remembered_email', trimmedEmail);
        localStorage.setItem('taxflow_auth_token', data.token);
      } else {
        sessionStorage.setItem('taxflow_auth_token', data.token);
      }

      setSuccessMessage('Account created successfully! Loading your dashboard...');
      setTimeout(() => {
        onLoginSuccess(data.token, data.user, data.firm);
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to register account.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Email is required.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to process password reset request.');
      }

      setSuccessMessage('Password reset instructions generated. Please verify to set a new password.');
      if (data.resetToken) {
        setResetToken(data.resetToken);
        setView('RESET_PASSWORD');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error requesting password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!resetToken.trim() || !newPassword) {
      setErrorMessage('Reset token and new password are required.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken: resetToken.trim(), newPassword }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid or expired password reset token.');
      }

      setSuccessMessage('Password reset successfully! You can now log in with your new password.');
      setView('LOGIN');
      setPassword(newPassword);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error updating password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Background Decorative Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl -translate-y-24"></div>
        <div className="w-[450px] h-[450px] bg-sky-600/5 rounded-full blur-3xl translate-x-48 translate-y-36"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* TaxFlow Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 shadow-xl shadow-emerald-950/60 border border-emerald-500/30 text-white font-black text-2xl mb-4 tracking-tight">
            TF
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">TaxFlow</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800 uppercase tracking-wider">
              Enterprise
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
            Indian Accounting, Multi-Bank Ingestion &amp; GST Automation Platform
          </p>
        </div>

        {/* Authentication Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Card Title & Description */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {view === 'LOGIN' && 'Sign in to TaxFlow'}
                {view === 'SIGNUP' && 'Create Practice / Client Account'}
                {view === 'FORGOT_PASSWORD' && 'Recover Password'}
                {view === 'RESET_PASSWORD' && 'Set New Password'}
              </h2>
              {view !== 'LOGIN' && (
                <button
                  type="button"
                  onClick={() => {
                    setView('LOGIN');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Login</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {view === 'LOGIN' && 'Enter your credentials to access your secure firm books and portal.'}
              {view === 'SIGNUP' && 'Register your CA practice, accounting profile, or enterprise portal.'}
              {view === 'FORGOT_PASSWORD' && 'Enter your registered email address to receive reset instructions.'}
              {view === 'RESET_PASSWORD' && 'Enter your reset token and your new secure password.'}
            </p>
          </div>

          {/* Alert Notifications */}
          {errorMessage && (
            <div
              id="auth-error-alert"
              role="alert"
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div
              id="auth-success-alert"
              role="status"
              className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* VIEW: LOGIN */}
          {view === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="ca.name@firm.in or client@enterprise.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans transition-all"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    id="forgot-password-link"
                    onClick={() => {
                      setView('FORGOT_PASSWORD');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans transition-all"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    id="toggle-password-visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    id="remember-me-checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-900 accent-emerald-500 cursor-pointer"
                  />
                  <span>Remember me on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="login-submit-button"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Switch to Signup */}
              <div className="pt-4 border-t border-slate-800/80 text-center">
                <p className="text-xs text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    id="switch-to-signup"
                    onClick={() => {
                      setView('SIGNUP');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold hover:underline transition-colors"
                  >
                    Create account / Sign up
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* VIEW: SIGNUP */}
          {view === 'SIGNUP' && (
            <form onSubmit={handleSignup} className="space-y-3.5" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="signup-name">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. CA Rajesh Sharma"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="signup-email">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@firm.com"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="signup-password">
                  Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Platform Role
                  </label>
                  <select
                    id="signup-role"
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                  >
                    <option value="FIRM_OWNER">Firm Owner / Partner</option>
                    <option value="CA">Chartered Accountant (CA)</option>
                    <option value="MANAGER">Audit / Tax Manager</option>
                    <option value="ACCOUNTANT">Senior Accountant</option>
                    <option value="GST_EXECUTIVE">GST Compliance Executive</option>
                    <option value="DATA_ENTRY_OPERATOR">Data Entry Operator</option>
                    <option value="REVIEWER">Reviewer / QA Auditor</option>
                    <option value="CLIENT">Client Portal User</option>
                    <option value="SUPER_ADMIN">Super Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="signup-phone">
                    Phone / Mobile
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-500 pointer-events-none" />
                    <input
                      id="signup-phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98200 00000"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1" htmlFor="signup-firm">
                  Firm / Practice / Company Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-500 pointer-events-none" />
                  <input
                    id="signup-firm"
                    type="text"
                    value={firmName}
                    onChange={e => setFirmName(e.target.value)}
                    placeholder="e.g. Sharma & Associates, Chartered Accountants"
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="signup-submit-button"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setView('LOGIN');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {view === 'FORGOT_PASSWORD' && (
            <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="forgot-email">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                id="forgot-submit-button"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing request...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Send Password Reset Instructions</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* VIEW: RESET PASSWORD */}
          {view === 'RESET_PASSWORD' && (
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="reset-token">
                  Reset Verification Token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  value={resetToken}
                  onChange={e => setResetToken(e.target.value)}
                  placeholder="Paste reset token here"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="new-password">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="reset-submit-button"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting new password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security / Compliance Badge Footer */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            256-Bit Encrypted Session
          </span>
          <span>•</span>
          <span>Indian ICAI &amp; GST Standards</span>
          <span>•</span>
          <span>Tally Prime Ready</span>
        </div>
      </div>
    </div>
  );
};
