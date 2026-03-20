import { useState, useRef, useEffect, useCallback } from 'react';
import useStore from '../store/useStore';
import UserAvatar from './UserAvatar';
import { FiCheck, FiCopy, FiTrash2, FiPlay, FiPause } from 'react-icons/fi';
import * as api from '../utils/api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function isImageUrl(content) {
  if (!content) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content);
}

function isFileUpload(content) {
  if (!content) return false;
  return content.startsWith('/uploads/') || content.startsWith('http');
}

// ==================== Voice Message Player ====================

function VoicePlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Generate fake waveform bars (deterministic from src)
  const bars = useRef(
    Array.from({ length: 28 }, (_, i) => {
      const seed = (i * 7 + 13) % 17;
      return 4 + (seed / 17) * 26;
    })
  ).current;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBarCount = Math.floor(progress * bars.length);

  return (
    <div className="voice-message" onClick={togglePlay}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button className="voice-play-btn" type="button">
        {playing ? <FiPause size={16} /> : <FiPlay size={16} />}
      </button>
      <div className="voice-waveform">
        {bars.map((h, i) => (
          <div
            key={i}
            className="voice-bar"
            style={{
              height: `${h}px`,
              opacity: i <= activeBarCount ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <span className="voice-duration">
        {playing ? formatDuration(currentTime) : formatDuration(duration)}
      </span>
    </div>
  );
}

// ==================== Video Circle Player ====================

function VideoCircle({ src }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoaded = () => setDuration(video.duration);
    const onEnded = () => setPlaying(false);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().catch(() => {});
      setPlaying(true);
    }
  };

  return (
    <div className="video-circle" onClick={togglePlay}>
      <video ref={videoRef} src={src} preload="metadata" playsInline loop />
      {!playing && (
        <div className="video-circle-overlay">
          <FiPlay size={32} />
        </div>
      )}
      <div className="video-circle-duration">{formatDuration(duration)}</div>
    </div>
  );
}

// ==================== Image Overlay ====================

function ImageOverlay({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="image-overlay" onClick={onClose}>
      <img src={src} alt="изображение" className="image-overlay__img" />
    </div>
  );
}

// ==================== Main Component ====================

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showImageOverlay, setShowImageOverlay] = useState(false);
  const menuRef = useRef(null);
  const { activeChat } = useStore();

  useEffect(() => {
    const handleClick = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  useEffect(() => {
    const el = document.getElementById('messages-bottom');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setShowMenu(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteMessage(activeChat.id, message.id);
    } catch (e) {
      console.error('Не удалось удалить сообщение', e);
    }
    setShowMenu(false);
  };

  const closeOverlay = useCallback(() => setShowImageOverlay(false), []);

  if (message.is_deleted) {
    return (
      <div className={`message ${isOwn ? 'message--own' : ''}`}>
        {!isOwn && showAvatar && (
          <UserAvatar
            name={message.sender_name || '?'}
            userId={message.sender_id}
            size={32}
            showStatus={false}
          />
        )}
        {!isOwn && !showAvatar && <div className="message__avatar-spacer" />}
        <div className="message__bubble message__bubble--deleted">
          <span className="message__deleted-text">сообщение удалено</span>
        </div>
      </div>
    );
  }

  const content = message.content || '';
  const fileUrl = message.file_url || '';
  const msgType = message.type || 'text';

  // Determine what to render based on message type
  const renderContent = () => {
    // Voice message
    if (msgType === 'voice' && fileUrl) {
      return <VoicePlayer src={fileUrl} />;
    }

    // Video circle message
    if (msgType === 'video_circle' && fileUrl) {
      return <VideoCircle src={fileUrl} />;
    }

    // Video message
    if (msgType === 'video' && fileUrl) {
      return (
        <div className="video-message">
          <video src={fileUrl} controls preload="metadata" playsInline />
        </div>
      );
    }

    // Image message (by type or by extension)
    if (msgType === 'image' && fileUrl) {
      return (
        <>
          <div
            className={`image-message ${isOwn ? 'image-message--own' : ''}`}
            onClick={() => setShowImageOverlay(true)}
          >
            <img src={fileUrl} alt="фото" loading="lazy" />
          </div>
          {showImageOverlay && <ImageOverlay src={fileUrl} onClose={closeOverlay} />}
        </>
      );
    }

    // File message
    if (msgType === 'file' && fileUrl) {
      return (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="message__file-link">
          [ФАЙЛ] {content || fileUrl.split('/').pop()}
        </a>
      );
    }

    // Legacy: detect image from URL
    const isImage = isImageUrl(content) || isImageUrl(fileUrl);
    if (isImage) {
      const imgSrc = fileUrl || content;
      return (
        <>
          <div
            className={`image-message ${isOwn ? 'image-message--own' : ''}`}
            onClick={() => setShowImageOverlay(true)}
          >
            <img src={imgSrc} alt="вложение" loading="lazy" />
          </div>
          {showImageOverlay && <ImageOverlay src={imgSrc} onClose={closeOverlay} />}
        </>
      );
    }

    // Legacy: detect file upload from content
    if (isFileUpload(content)) {
      return (
        <a href={content} target="_blank" rel="noopener noreferrer" className="message__file-link">
          [ФАЙЛ] {content.split('/').pop()}
        </a>
      );
    }

    // Plain text
    return <div className="message__text">{content}</div>;
  };

  return (
    <div
      className={`message ${isOwn ? 'message--own' : ''} ${showAvatar ? 'message--first' : ''}`}
      onContextMenu={handleContextMenu}
    >
      {!isOwn && showAvatar && (
        <UserAvatar
          name={message.sender_name || '?'}
          userId={message.sender_id}
          size={32}
          showStatus={false}
        />
      )}
      {!isOwn && !showAvatar && <div className="message__avatar-spacer" />}

      <div className={`message__bubble ${isOwn ? 'message__bubble--own' : ''}`}>
        {!isOwn && showAvatar && (
          <div className="message__sender">{message.sender_name}</div>
        )}

        {renderContent()}

        <div className="message__meta">
          <span className="message__time">{formatTime(message.created_at)}</span>
          {isOwn && (
            <span className={`message__read ${message.is_read ? 'message__read--read' : ''}`}>
              {message.is_read ? (
                <>
                  <FiCheck size={12} />
                  <FiCheck size={12} style={{ marginLeft: -6 }} />
                </>
              ) : (
                <FiCheck size={12} />
              )}
            </span>
          )}
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            left: menuPos.x,
            top: menuPos.y,
          }}
        >
          <button className="context-menu__item" onClick={handleCopy}>
            <FiCopy size={14} /> Копировать
          </button>
          {isOwn && (
            <button
              className="context-menu__item context-menu__item--danger"
              onClick={handleDelete}
            >
              <FiTrash2 size={14} /> Удалить
            </button>
          )}
        </div>
      )}
    </div>
  );
}
