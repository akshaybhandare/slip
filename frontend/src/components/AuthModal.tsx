import React, { useState, useEffect } from 'react';
import { Bookmark as BookmarkIcon, Lock, User as UserIcon } from 'lucide-react';
import { loginUser, registerUser, getAuthStatus } from '../api';
import { User } from '../types';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registeredMsg, setRegisteredMsg] = useState('');

  useEffect(() => {
    getAuthStatus()
      .then((status) => {
        if (!status.initialized) {
          setIsFirstUser(true);
          setIsLogin(false); // First user must register admin account
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError('');
    setRegisteredMsg('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await loginUser(username.trim(), password);
        onSuccess(data.user);
      } else {
        const regData = await registerUser(username.trim(), password);
        if (regData.user) {
          onSuccess(regData.user);
        } else {
          setRegisteredMsg('Registered successfully! Logging you in...');
          const data = await loginUser(username.trim(), password);
          onSuccess(data.user);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '440px', padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="brand-logo" style={{ width: '44px', height: '44px', margin: '0 auto 12px', background: 'var(--color-primary)' }}>
            <BookmarkIcon size={22} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 600, letterSpacing: '-0.6px', color: 'var(--color-secondary)' }}>
            {isLogin ? 'Welcome to Slip' : (isFirstUser ? 'Create Admin Account' : 'Create Account')}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-muted)', marginTop: '4px' }}>
            {isLogin
              ? 'Sign in to access your visual archive'
              : (isFirstUser ? 'Setup your primary administrator account to get started' : 'Register a new user account')}
          </p>
        </div>

        {error && (
          <div style={{ color: 'var(--color-error)', fontSize: '13px', marginBottom: '14px', background: 'rgba(228, 43, 12, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        {registeredMsg && (
          <div style={{ color: 'var(--color-secondary)', fontSize: '13px', marginBottom: '14px', background: 'var(--color-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
            {registeredMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div style={{ position: 'relative' }}>
              <UserIcon size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input
                type="text"
                required
                className="form-input"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
              <input
                type="password"
                required
                className="form-input"
                style={{ width: '100%', paddingLeft: '40px' }}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : (isFirstUser ? 'Create Admin Account' : 'Sign In')}
          </button>
        </form>
      </div>
    </div>
  );
};
