import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

import { loginUser, registerBusiness } from './api.js';
import './AuthPage.css';

const initialForm = {
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  identifier: '',
  password: '',
};

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isRegister = mode === 'register';

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError('');
    setSuccess('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (isRegister) {
      if (!form.email.trim() && !form.phone.trim()) {
        setError('Please enter an email address or phone number.');
        return;
      }

      if (form.password.length < 12) {
        setError('Your password must contain at least 12 characters.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegister) {
        await registerBusiness({
          businessName: form.businessName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        });

        setForm((current) => ({
          ...initialForm,
          identifier: current.email.trim() || current.phone.trim(),
        }));

        setMode('login');
        setSuccess(
          'Your business account has been created. Please sign in.'
        );
      } else {
        const result = await loginUser({
          identifier: form.identifier.trim(),
          password: form.password,
        });

        onLogin(result);
      }
    } catch (requestError) {
      setError(
        requestError.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError('');
    setSuccess('');
    setShowPassword(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand">
          <span className="auth-brand-mark">
            <Activity size={25} />
          </span>

          <span className="auth-brand-name">
            EthioBiz <strong>OS</strong>
          </span>
        </div>

        <div className="auth-story-content">
          <span className="auth-kicker">
            BUSINESS MANAGEMENT, SIMPLIFIED
          </span>

          <h1>
            Run your business.
            <br />
            Understand your growth.
          </h1>

          <p>
            Manage products, track sales, monitor inventory and
            understand your business performance in one workspace.
          </p>

          <div className="auth-benefit">
            <span className="auth-benefit-icon">
              <ShieldCheck size={20} />
            </span>

            <div>
              <strong>Your business, your workspace</strong>
              <span>
                Your account accesses its own business records.
              </span>
            </div>
          </div>
        </div>

        <p className="auth-story-footer">
          Built for businesses in Ethiopia.
        </p>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-card">
          <div className="auth-mobile-brand">
            <Activity size={23} />
            <span>EthioBiz <strong>OS</strong></span>
          </div>

          <div className="auth-heading">
            <span className="auth-form-eyebrow">
              YOUR BUSINESS WORKSPACE
            </span>

            <h2>
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>

            <p>
              {isRegister
                ? 'Register your business to get started.'
                : 'Sign in to continue to your business dashboard.'}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegister ? 'selected' : ''}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>

            <button
              type="button"
              className={isRegister ? 'selected' : ''}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>

          {error && (
            <div className="auth-message auth-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="auth-message auth-success" role="status">
              {success}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister ? (
              <>
                <div className="auth-field">
                  <label htmlFor="businessName">Business name</label>
                  <input
                    id="businessName"
                    name="businessName"
                    value={form.businessName}
                    onChange={updateField}
                    placeholder="e.g. Abebe Mini Market"
                    maxLength={150}
                    autoComplete="organization"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="ownerName">Owner's full name</label>
                  <input
                    id="ownerName"
                    name="ownerName"
                    value={form.ownerName}
                    onChange={updateField}
                    placeholder="Enter your full name"
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="email">
                    Email address <span>(optional)</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={updateField}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="phone">
                    Phone number <span>(optional)</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={updateField}
                    placeholder="+251 ..."
                    maxLength={30}
                    autoComplete="tel"
                  />
                  <small>Enter an email address or phone number, at least one.</small>
                </div>
              </>
            ) : (
              <div className="auth-field">
                <label htmlFor="identifier">Email or phone number</label>
                <input
                  id="identifier"
                  name="identifier"
                  value={form.identifier}
                  onChange={updateField}
                  placeholder="Enter your email or phone"
                  autoComplete="username"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="password">Password</label>

              <div className="auth-password-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={updateField}
                  placeholder={
                    isRegister
                      ? 'At least 12 characters'
                      : 'Enter your password'
                  }
                  minLength={isRegister ? 12 : undefined}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {isRegister && (
                <small>Use at least 12 characters for your password.</small>
              )}
            </div>

            <button
              className="auth-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? 'Please wait...'
                  : isRegister
                    ? 'Create business account'
                    : 'Sign in to EthioBiz'}
              </span>

              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <p className="auth-privacy-note">
            Your business data is accessed through your authenticated account.
          </p>
        </div>

        <p className="auth-copyright">
          © {new Date().getFullYear()} EthioBiz OS
        </p>
      </section>
    </main>
  );
}
