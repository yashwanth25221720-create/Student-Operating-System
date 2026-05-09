import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { Zap, Loader2 } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState('register');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const result = await base44.auth.register({ email, password });
      if (result.session) {
        window.location.href = '/';
        return;
      }
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode });
      base44.auth.setToken(res.access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Verification failed. Check the latest code in your email and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await base44.auth.loginWithProvider('google', '/');
    } catch (err) {
      setError(err.message || 'Google sign-in is not configured correctly yet.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">SOS</span>
          </div>
          <h1 className="text-2xl font-bold">{step === 'register' ? 'Create account' : 'Verify email'}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 'register' ? 'Start your journey with SOS' : `Enter the OTP sent to ${email}`}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">{error}</div>
        )}

        {step === 'register' ? (
          <>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Account
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">or</span></div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleGoogle}>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </Button>
          </>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="Enter code" required className="text-center text-lg tracking-widest" />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Verify
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Check your Gmail inbox and spam folder. The newest OTP is the one that works.
            </p>
            <button type="button" onClick={() => base44.auth.resendOtp(email)} className="text-xs text-primary hover:underline w-full text-center">
              Resend code
            </button>
          </form>
        )}

        <p className="text-sm text-muted-foreground text-center">
          Already have an account? <Link to="/sign-in" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
