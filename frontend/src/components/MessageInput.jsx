import { useState, useRef, useCallback, useEffect } from 'react';
import useStore from '../store/useStore';
import * as api from '../utils/api';
import { FiSend, FiPaperclip, FiMic, FiVideo, FiX, FiCheck, FiImage, FiFile } from 'react-icons/fi';

function formatRecordingTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MessageInput() {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  // Video circle recording state
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoSeconds, setVideoSeconds] = useState(0);

  const fileRef = useRef(null);
  const mediaFileRef = useRef(null);
  const textareaRef = useRef(null);
  const lastTypingRef = useRef(0);

  // Recording refs
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  const { activeChat, sendTyping } = useStore();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllRecording();
    };
  }, []);

  // Close attach menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.attach-menu-wrapper')) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showAttachMenu]);

  const scrollToBottom = () => {
    setTimeout(() => {
      const el = document.getElementById('messages-bottom');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  };

  const stopAllRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    chunksRef.current = [];
  };

  // ==================== TEXT SEND ====================

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !activeChat || sending) return;

    setSending(true);
    try {
      await api.sendMessage(activeChat.id, trimmed);
      setText('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      scrollToBottom();
    } catch (e) {
      alert('Не удалось отправить сообщение.');
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
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }
    if (activeChat) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        sendTyping(activeChat.id);
      }
    }
  };

  // ==================== FILE/MEDIA UPLOAD ====================

  const handleAttachClick = (e) => {
    e.stopPropagation();
    setShowAttachMenu((prev) => !prev);
  };

  const handleMediaSelect = () => {
    setShowAttachMenu(false);
    mediaFileRef.current?.click();
  };

  const handleFileSelect = () => {
    setShowAttachMenu(false);
    fileRef.current?.click();
  };

  const detectMediaType = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'file';
  };

  const handleMediaFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const type = detectMediaType(file);
    setUploading(true);
    setUploadProgress(0);
    try {
      await api.uploadAndSendMedia(activeChat.id, file, type, setUploadProgress);
      scrollToBottom();
    } catch (err) {
      alert('Не удалось загрузить файл.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (mediaFileRef.current) mediaFileRef.current.value = '';
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      await api.uploadAndSendMedia(activeChat.id, file, 'file', setUploadProgress);
      scrollToBottom();
    } catch (err) {
      alert('Не удалось загрузить файл.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ==================== VOICE RECORDING ====================

  const startVoiceRecording = async () => {
    if (!activeChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecordingVoice(true);
      setVoiceSeconds(0);

      timerRef.current = setInterval(() => {
        setVoiceSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Нет доступа к микрофону. Разрешите доступ в настройках браузера.');
    }
  };

  const sendVoiceRecording = async () => {
    if (!mediaRecorderRef.current || !activeChat) return;

    const recorder = mediaRecorderRef.current;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        if (blob.size > 0) {
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
          setUploading(true);
          setUploadProgress(0);
          try {
            await api.uploadAndSendMedia(activeChat.id, file, 'voice', setUploadProgress);
            scrollToBottom();
          } catch (err) {
            alert('Не удалось отправить голосовое сообщение.');
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        }

        setIsRecordingVoice(false);
        setVoiceSeconds(0);
        resolve();
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        setIsRecordingVoice(false);
        setVoiceSeconds(0);
        resolve();
      }
    });
  };

  const cancelVoiceRecording = () => {
    stopAllRecording();
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
  };

  // ==================== VIDEO CIRCLE RECORDING ====================

  const startVideoRecording = async () => {
    if (!activeChat) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Show preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecordingVideo(true);
      setVideoSeconds(0);

      timerRef.current = setInterval(() => {
        setVideoSeconds((prev) => {
          if (prev >= 59) {
            // Auto-stop at 60s
            sendVideoRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      alert('Нет доступа к камере/микрофону. Разрешите доступ в настройках браузера.');
    }
  };

  const sendVideoRecording = async () => {
    if (!mediaRecorderRef.current || !activeChat) return;

    const recorder = mediaRecorderRef.current;

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
        }

        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        chunksRef.current = [];

        if (blob.size > 0) {
          const file = new File([blob], `video_circle_${Date.now()}.webm`, { type: 'video/webm' });
          setUploading(true);
          setUploadProgress(0);
          try {
            await api.uploadAndSendMedia(activeChat.id, file, 'video_circle', setUploadProgress);
            scrollToBottom();
          } catch (err) {
            alert('Не удалось отправить видеосообщение.');
          } finally {
            setUploading(false);
            setUploadProgress(0);
          }
        }

        setIsRecordingVideo(false);
        setVideoSeconds(0);
        resolve();
      };

      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        setIsRecordingVideo(false);
        setVideoSeconds(0);
        resolve();
      }
    });
  };

  const cancelVideoRecording = () => {
    stopAllRecording();
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setIsRecordingVideo(false);
    setVideoSeconds(0);
  };

  // ==================== RENDER ====================

  // Voice recording UI
  if (isRecordingVoice) {
    return (
      <div className="message-input message-input--recording">
        <div className="recording-indicator">
          <span className="recording-dot" />
          <span className="recording-timer">{formatRecordingTime(voiceSeconds)}</span>
          <span className="recording-label">Запись...</span>
        </div>
        <div className="recording-actions">
          <button className="icon-btn recording-cancel" onClick={cancelVoiceRecording} title="Отмена">
            <FiX />
          </button>
          <button className="icon-btn recording-send" onClick={sendVoiceRecording} title="Отправить">
            <FiCheck />
          </button>
        </div>
      </div>
    );
  }

  // Video circle recording UI
  if (isRecordingVideo) {
    return (
      <div className="message-input message-input--recording-video">
        <div className="video-record-preview">
          <video ref={videoPreviewRef} muted playsInline className="video-record-circle" />
          <div className="video-record-timer">{formatRecordingTime(videoSeconds)}</div>
        </div>
        <div className="recording-actions">
          <button className="icon-btn recording-cancel" onClick={cancelVideoRecording} title="Отмена">
            <FiX />
          </button>
          <button className="icon-btn recording-send" onClick={sendVideoRecording} title="Отправить">
            <FiCheck />
          </button>
        </div>
      </div>
    );
  }

  // Upload progress
  if (uploading) {
    return (
      <div className="message-input message-input--uploading">
        <div className="upload-progress-container">
          <div className="upload-progress-text">Загрузка... {uploadProgress}%</div>
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  const inputIsEmpty = !text.trim();

  return (
    <div className="message-input">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={mediaFileRef}
        onChange={handleMediaFileChange}
        style={{ display: 'none' }}
        accept="image/*,video/*"
      />
      <input
        type="file"
        ref={fileRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Attach button with menu */}
      <div className="attach-menu-wrapper">
        <button
          className="icon-btn message-input__attach"
          onClick={handleAttachClick}
          title="Прикрепить"
        >
          <FiPaperclip />
        </button>
        {showAttachMenu && (
          <div className="attach-menu">
            <div className="attach-menu-item" onClick={handleMediaSelect}>
              <FiImage size={14} />
              <span>Фото/Видео</span>
            </div>
            <div className="attach-menu-item" onClick={handleFileSelect}>
              <FiFile size={14} />
              <span>Файл</span>
            </div>
          </div>
        )}
      </div>

      {/* Text input */}
      <textarea
        ref={textareaRef}
        className="message-input__field"
        placeholder="Введите сообщение..."
        value={text}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        rows={1}
      />

      {/* Video circle button */}
      <button
        className="icon-btn message-input__video-circle"
        onClick={startVideoRecording}
        title="Видеосообщение"
      >
        <FiVideo />
      </button>

      {/* Mic or Send button */}
      {inputIsEmpty ? (
        <button
          className="icon-btn message-input__mic"
          onClick={startVoiceRecording}
          title="Голосовое сообщение"
        >
          <FiMic />
        </button>
      ) : (
        <button
          className="icon-btn message-input__send"
          onClick={handleSend}
          disabled={sending}
          title="Отправить"
        >
          <FiSend />
        </button>
      )}
    </div>
  );
}
