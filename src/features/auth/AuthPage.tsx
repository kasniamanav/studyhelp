import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';
import { useUIStore } from '../../store/useUIStore';
import { Sparkles, Mail, Lock, User, ArrowRight, KeyRound, AlertCircle, Info } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { user, signInDemoGuest } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleHelp, setGoogleHelp] = useState(false);
  const { addToast } = useUIStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      addToast('Please enter both email and password', false);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (
        error.code === 'email_not_confirmed' ||
        error.message?.toLowerCase().includes('not confirmed')
      ) {
        setAuthError(
          'Email not confirmed yet. Check your inbox for the confirmation link, or disable "Confirm email" in Supabase Dashboard (Authentication -> Providers -> Email).'
        );
      } else {
        setAuthError(error.message);
      }
      addToast(error.message, false);
    } else {
      addToast('Welcome back!');
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      addToast('Please enter both email and password', false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || 'Student' },
      },
    });
    setLoading(false);
    if (error) {
      if (error.code === 'over_email_send_rate_limit' || error.message?.includes('rate limit')) {
        setAuthError(
          'Supabase email rate limit reached (free tier limit of 3-4 emails/hour). To bypass this instantly: in Supabase Dashboard -> Authentication -> Providers -> Email, toggle OFF "Confirm email".'
        );
      } else {
        setAuthError(error.message);
      }
      addToast(error.message, false);
    } else {
      if (data?.session) {
        addToast('Welcome to StudyAI!');
        navigate('/dashboard', { replace: true });
      } else {
        setAuthError(
          'Account registered! If email confirmation is enabled in your Supabase project, check your inbox to confirm before signing in.'
        );
        addToast('Account created! Please check your email to confirm or sign in.');
        setTab('signin');
      }
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email) {
      addToast('Please enter your email', false);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setAuthError(error.message);
      addToast(error.message, false);
    } else {
      addToast('Password reset link sent to your email.');
      setTab('signin');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
        },
      });

      if (error) {
        setAuthError(
          'Google OAuth is not enabled in your Supabase dashboard yet. To enable it: go to Supabase Dashboard -> Authentication -> Providers -> Google, toggle it on, and paste your Google Cloud Client ID & Secret.'
        );
        addToast(error.message, false);
        setLoading(false);
      } else if (data?.url) {
        // Redirect to Google authorization
        window.location.href = data.url;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google OAuth failed');
      setLoading(false);
    }
  };

  // Quick Demo Account for instant evaluation without email confirmation
  const handleQuickDemo = async () => {
    setLoading(true);
    setAuthError(null);
    const demoEmail = 'student.demo@studyai.app';
    const demoPassword = 'StudyAIDemoPassword2026!';

    try {
      // 1. Try real Supabase sign-in
      const res = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (res.data?.session) {
        addToast('Logged in as Demo Student!');
        navigate('/dashboard', { replace: true });
        setLoading(false);
        return;
      }

      // 2. Try creating account if not present
      const signUpRes = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: { data: { full_name: 'Demo Student' } },
      });

      if (signUpRes.data?.session) {
        addToast('Demo account ready! Welcome.');
        navigate('/dashboard', { replace: true });
        setLoading(false);
        return;
      }
    } catch (_) {
      // Fall through to instant session
    }

    // 3. Fallback: activate Instant Demo Session immediately (never blocked)
    signInDemoGuest();
    addToast('Logged in with Instant Demo Access!');
    navigate('/dashboard', { replace: true });
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="card w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/10 text-primary mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">StudyAI</h1>
          <p className="text-sm text-muted mt-1">Your AI-powered personalized study companion</p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border mb-4">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'signin' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}
            onClick={() => { setTab('signin'); setAuthError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'signup' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}
            onClick={() => { setTab('signup'); setAuthError(null); }}
          >
            Create Account
          </button>
        </div>

        {authError && (
          <div className="card p-3 mb-4 border-amber-300 dark:border-amber-800 bg-amber-500/10 text-xs text-foreground flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{authError}</div>
          </div>
        )}

        {/* Instant Access Banner */}
        <div className="card p-3 mb-4 bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40">
          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={loading}
            className="btn w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
          >
            <KeyRound className="w-4 h-4" />
            1-Click Instant Access (Bypass Email Verification)
          </button>
        </div>

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted">Password</label>
                <button
                  type="button"
                  onClick={() => setTab('forgot')}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-9"
                />
                <Lock className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-o w-full py-2.5">
              {loading ? 'Signing in…' : 'Sign In with Email'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Display Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="pl-9"
                />
                <User className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="pl-9"
                />
                <Lock className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-o w-full py-2.5">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-muted">
              Enter your email address and we will send you a link to reset your password.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn w-full py-2.5">
              {loading ? 'Sending link…' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => setTab('signin')}
              className="text-xs text-center w-full block text-muted hover:text-foreground mt-2"
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <span className="relative bg-card px-3 text-xs uppercase text-muted font-medium">Or continue with</span>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="btn-o w-full py-2 text-sm flex items-center justify-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={() => setGoogleHelp(!googleHelp)}
            className="text-[11px] text-muted hover:text-foreground text-center w-full flex items-center justify-center gap-1 mt-1"
          >
            <Info className="w-3 h-3" /> How to configure Google Login in Supabase
          </button>

          {googleHelp && (
            <div className="card p-3 text-xs text-muted bg-zinc-50 dark:bg-zinc-900/50 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-foreground">To enable Google OAuth:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Go to your Supabase Dashboard -&gt; <strong>Authentication</strong> -&gt; <strong>Providers</strong>.</li>
                <li>Find <strong>Google</strong> and toggle it <strong>ON</strong>.</li>
                <li>Add your Google Cloud OAuth Client ID &amp; Secret (or use Email login / 1-Click Instant Access).</li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
