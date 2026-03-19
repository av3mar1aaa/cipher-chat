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

  const titleText = '> ПОДКЛЮЧЕНИЕ К ЗАЩИЩЁННОМУ ТЕРМИНАЛУ...';

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
        err.response?.data?.detail || 'Доступ запрещён. Неверные учётные данные.'
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
            <label htmlFor="username">ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="имя_пользователя"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">ПАРОЛЬ</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="введите_пароль"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <span className="loading-dots">
                АУТЕНТИФИКАЦИЯ<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              '[ ВОЙТИ В СИСТЕМУ ]'
            )}
          </button>
        </form>

        <div className="auth-link">
          <span className="text-dim">Нет аккаунта?</span>{' '}
          <Link to="/register">&gt; СОЗДАТЬ_АККАУНТ</Link>
        </div>

        <div className="auth-footer">
          <span className="text-dim">
            // Все сообщения зашифрованы сквозным шифрованием
          </span>
        </div>
      </div>

      <div className="scanline-overlay" />
    </div>
  );
}
