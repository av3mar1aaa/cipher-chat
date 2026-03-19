import { useState, useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import { FiSend, FiPaperclip } from 'react-icons/fi';

export default function MessageInput() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const lastTypingRef = useRef(0);
  const { activeChat, sendTyping } = useStore();

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeChat || sending) return;

    setSending(true);
    try {
      await api.sendMessage(activeChat.id, trimmed);
      setText('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      // Scroll to bottom
      setTimeout(() => {
        const el = document.getElementById('messages-bottom');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      alert('Не удалось отправить сообщение. Попробуйте снова.');
    } finally {
      setSending(false);
    }
  }, [text, activeChat, sending]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);

    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }

    // Send typing event (throttled)
    if (activeChat) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        sendTyping(activeChat.id);
      }
    }
  };

  const handleFileClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    setUploading(true);
    try {
      await api.uploadFile(activeChat.id, file);
      setTimeout(() => {
        const el = document.getElementById('messages-bottom');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err) {
      alert('Не удалось загрузить файл. Попробуйте снова.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="message-input">
      <input
        type="file"
        ref={fileRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept="image/*,.pdf,.doc,.docx,.txt,.zip"
      />

      <button
        className="icon-btn message-input__attach"
        onClick={handleFileClick}
        disabled={uploading}
        title="Прикрепить файл"
      >
        <FiPaperclip />
      </button>

      <textarea
        ref={textareaRef}
        className="message-input__field"
        placeholder={uploading ? 'Загрузка файла...' : 'Введите сообщение...'}
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={uploading}
      />

      <button
        className="icon-btn message-input__send"
        onClick={handleSend}
        disabled={!text.trim() || sending}
        title="Отправить"
      >
        <FiSend />
      </button>
    </div>
  );
}
