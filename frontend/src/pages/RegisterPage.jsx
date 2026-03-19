import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';

const ASCII_LOGO = `
 ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗
██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗
██║     ██║██████╔╝███████║█████╗  ██████╔╝
██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗
╚██████╗██║██║     ██║  ██║███████╗██║  ██║
 ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
`;

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayedTitle, setDisplayedTitle] = useState('');
  const register = useStore((s) => s.register);
  const navigate = useNavigate();

  const titleText = '> CREATING NEW IDENTITY...';

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i <= titleText.length) {
        setDisplayedTitle(titleText.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('ERROR: Passwords do not match');
      return;
    }
    if (password.length < 4) {
      setError('ERROR: Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      await register(username, password, displayName || username);
      navigate('/chat');
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Identity creation failed. Try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <pre className="ascii-logo">{ASCII_LOGO}</pre>
        <div className="typing-title">
          {displayedTitle}
          <span className="cursor-blink">_</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="input-group">
            <label htmlFor="username">USERNAME</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="choose_username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="displayName">DISPLAY_NAME</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="optional_display_name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">PASSWORD</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="create_password"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">CONFIRM_PASSWORD</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="repeat_password"
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <span className="loading-dots">
                PROCESSING<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              '[ CREATE IDENTITY ]'
            )}
          </button>
        </form>

        <div className="auth-link">
          <span className="text-dim">Already have access?</span>{' '}
          <Link to="/login">&gt; ACCESS_SYSTEM</Link>
        </div>

        <div className="auth-footer">
          <span className="text-dim">
            // All communications encrypted end-to-end
          </span>
        </div>
      </div>

      <div className="scanline-overlay" />
    </div>
  );
}
