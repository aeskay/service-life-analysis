import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
);

export default function AuthModal({ isOpen, onClose, addToast }) {
  const authContext = useAuth() || {};
  const { login, signup, loginWithGoogle } = authContext;
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleGoogleSignIn() {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      addToast?.('success', 'Welcome', 'Signed in with Google successfully.');
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message ? err.message.replace('Firebase: ', '') : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (isSignUp && password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    try {
      setLoading(true);
      if (isSignUp) {
        await signup(email, password);
        addToast?.('success', 'Account Created', 'Successfully registered and logged in.');
      } else {
        await login(email, password);
        addToast?.('success', 'Welcome Back', 'Logged in successfully.');
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message ? err.message.replace('Firebase: ', '') : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)',
        width: 400, maxWidth: '90%', padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>
            {isSignUp ? 'Create Firebase Account' : 'Sign In to Firebase'}
          </h2>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5', padding: '10px 14px', borderRadius: 6, fontSize: 13
          }}>
            {error}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '10px', borderRadius: 6,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
            color: 'var(--text-main)', fontSize: 14, fontWeight: 500, cursor: 'pointer'
          }}
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Email Address</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 6,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 6,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box'
              }}
            />
          </div>

          {isSignUp && (
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Confirm Password</label>
              <input 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6,
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                  color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn--primary" 
            style={{ width: '100%', padding: '10px', marginTop: 6, justifyContent: 'center' }}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up with Email' : 'Sign In with Email')}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button 
            type="button" 
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
}
