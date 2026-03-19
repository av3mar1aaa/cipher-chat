import { useState, useRef, useEffect } from 'react';
import useStore from '../store/useStore';
import UserAvatar from './UserAvatar';
import { FiCheck, FiCopy, FiTrash2 } from 'react-icons/fi';
import * as api from '../utils/api';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isImageUrl(content) {
  if (!content) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(content);
}

function isFileUpload(content) {
  if (!content) return false;
  return content.startsWith('/uploads/') || content.startsWith('http');
}

export default function MessageBubble({ message, isOwn, showAvatar }) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);
  const { activeChat } = useStore();

  useEffect(() => {
    const handleClick = () => setShowMenu(false);
    if (showMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showMenu]);

  // Auto-scroll on mount
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
    navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  const handleDelete = async () => {
    try {
      await api.deleteMessage(activeChat.id, message.id);
    } catch (e) {
      console.error('Failed to delete message', e);
    }
    setShowMenu(false);
  };

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
          <span className="message__deleted-text">
            message was deleted
          </span>
        </div>
      </div>
    );
  }

  const content = message.content || '';
  const isImage = isImageUrl(content) || (message.file_url && isImageUrl(message.file_url));
  const imageUrl = message.file_url || content;

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

        {isImage ? (
          <div className="message__image">
            <img src={imageUrl} alt="attachment" loading="lazy" />
          </div>
        ) : isFileUpload(content) ? (
          <a
            href={content}
            target="_blank"
            rel="noopener noreferrer"
            className="message__file-link"
          >
            [FILE] {content.split('/').pop()}
          </a>
        ) : (
          <div className="message__text">{content}</div>
        )}

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
            <FiCopy size={14} /> Copy
          </button>
          {isOwn && (
            <button
              className="context-menu__item context-menu__item--danger"
              onClick={handleDelete}
            >
              <FiTrash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
