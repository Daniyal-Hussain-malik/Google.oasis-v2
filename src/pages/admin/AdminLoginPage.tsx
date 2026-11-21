import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@mui/material';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useAdminAuth } from '@/src/context/AdminAuthContext';
import { api } from '@/src/lib/api';
import { BrandLogo } from '@/src/components/BrandLogo';

export function AdminLoginPage() {
  const { login, claimInitialAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>('/auth/setup-status')
      .then((res) => setNeedsSetup(Boolean(res?.needsSetup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      toast.success(`Signed in as ${user.name}`);
      if (user.role === 'chef') navigate('/admin/restaurant/kitchen');
      else navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setBusy(false);
    }
  }

  async function handleSetupAdmin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await claimInitialAdmin(setupName.trim(), email.trim(), password);
      toast.success(`Super Admin account created for ${user.name}`);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Could not initialize administrator account');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/forgot', { method: 'POST', body: { email: forgotEmail.trim() } });
      setForgotSent(true);
      toast.success('If an account matches, a reset link was logged');
    } catch (err: any) {
      setError(err.message || 'Could not request reset');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Website
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <BrandLogo variant="auto" className="h-14 w-auto self-start" />
            <div className="flex items-center gap-2 text-accent">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Oasis Operations Desk</span>
            </div>
            <CardTitle className="font-display text-3xl font-semibold">
              {needsSetup
                ? 'Initialize Super Admin'
                : forgotMode
                  ? 'Reset Staff Password'
                  : 'Staff Sign In'}
            </CardTitle>
            <CardDescription>
              {needsSetup
                ? 'No staff accounts exist yet. Create the primary Super Admin account to lock setup.'
                : forgotMode
                  ? 'Enter your staff email to request a password reset token.'
                  : 'Sign in with your assigned resort role credentials.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {needsSetup ? (
              <form onSubmit={handleSetupAdmin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input
                    required
                    minLength={2}
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="e.g. Kashif Hassan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Admin Email</Label>
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@oasisresort.pk"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Password (min 8 chars, mixed characters)</Label>
                  <Input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="accent" className="w-full" disabled={busy}>
                  <KeyRound className="h-4 w-4" />
                  {busy ? 'Creating Account…' : 'Create Super Admin'}
                </Button>
              </form>
            ) : forgotMode ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Staff Email</Label>
                  <Input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@oasisresort.pk"
                  />
                </div>
                {error && <Alert severity="error">{error}</Alert>}
                {forgotSent && (
                  <Alert severity="success">Reset request processed. Check the server mail log or inbox.</Alert>
                )}
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForgotMode(false)}>
                    Back to Sign In
                  </Button>
                  <Button type="submit" variant="accent" disabled={busy}>
                    {busy ? 'Sending…' : 'Send Reset Link'}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@oasisresort.pk"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="accent" className="w-full" disabled={busy}>
                    {busy ? 'Signing in…' : 'Sign In'}
                  </Button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/reset', { method: 'POST', body: { token: token.trim(), password } });
      toast.success('Password updated. You can now sign in.');
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-3xl font-semibold">Set New Staff Password</CardTitle>
            <CardDescription>Enter the reset token from your email and choose a new password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Reset Token</Label>
                <Input required value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token" />
              </div>
              <div className="space-y-1.5">
                <Label>New Password (min 8 chars)</Label>
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <Alert severity="error">{error}</Alert>}
              <div className="flex items-center justify-between gap-2">
                <Button asChild type="button" variant="ghost" size="sm">
                  <Link to="/admin">Back to Sign In</Link>
                </Button>
                <Button type="submit" variant="accent" disabled={busy}>
                  {busy ? 'Saving…' : 'Update Password'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
