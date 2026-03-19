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

  const titleText = '> СОЗДАНИЕ НОВОГО АККАУНТА...';

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
      setError('ОШИБКА: Пароли не совпадают');
      return;
    }
    if (password.length < 4) {
      setError('ОШИБКА: Пароль должен содержать минимум 4 символа');
      return;
    }

    setLoading(true);
    try {
      await register(username, password, displayName || username);
      navigate('/chat');
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Не удалось создать аккаунт. Попробуйте снова.'
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
              placeholder="выберите_имя"
              autoComplete="username"
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="displayName">ОТОБРАЖАЕМОЕ_ИМЯ</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="необязательное_имя"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">ПАРОЛЬ</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="создайте_пароль"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">ПОДТВЕРДИТЕ_ПАРОЛЬ</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="повторите_пароль"
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? (
              <span className="loading-dots">
                ОБРАБОТКА<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              '[ СОЗДАТЬ АККАУНТ ]'
            )}
          </button>
        </form>

        <div className="auth-link">
          <span className="text-dim">Уже есть аккаунт?</span>{' '}
          <Link to="/login">&gt; ВОЙТИ</Link>
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
