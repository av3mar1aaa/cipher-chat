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
       ██████╗██╗  ██╗ █████╗ ████████╗
      ██╔════╝██║  ██║██╔══██╗╚══██╔══╝
      ██║     ███████║███████║   ██║
      ██║     ██╔══██║██╔══██║   ██║
      ╚██████╗██║  ██║██║  ██║   ██║
       ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
`;

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayedTitle, setDisplayedTitle] = useState('');
  const login = useStore((s) => s.login);
  const navigate = useNavigate();

  const titleText = '> ACCESSING SECURE TERMINAL...';

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
    setLoading(true);
    try {
      await login(username, password);
      navigate('/chat');
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Access denied. Invalid credentials.'
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
              placeholder="enter_username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">PASSWORD</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="enter_password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <span className="loading-dots">
                AUTHENTICATING<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              '[ ACCESS SYSTEM ]'
            )}
          </button>
        </form>

        <div className="auth-link">
          <span className="text-dim">No identity?</span>{' '}
          <Link to="/register">&gt; CREATE_IDENTITY</Link>
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
