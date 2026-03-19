import { useState, useMemo } from 'react';
import useStore from '../store/useStore';
import UserAvatar from './UserAvatar';
import { FiSearch } from 'react-icons/fi';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Вчера';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getChatName(chat, currentUserId) {
  if (chat.name) return chat.name;
  if (chat.type === 'private' && chat.participants) {
    const other = chat.participants.find((p) => p.id !== currentUserId);
    return other?.display_name || other?.username || 'Неизвестный';
  }
  return 'Чат';
}

function getChatAvatar(chat, currentUserId) {
  if (chat.type === 'private' && chat.participants) {
    const other = chat.participants.find((p) => p.id !== currentUserId);
    return { name: getChatName(chat, currentUserId), userId: other?.id };
  }
  return { name: getChatName(chat, currentUserId) };
}

export default function ChatList({ onMobileSelect }) {
  const [search, setSearch] = useState('');
  const { chats, activeChat, setActiveChat, user, unreadCounts, isLoadingChats } =
    useStore();

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.toLowerCase();
    return chats.filter((c) => {
      const name = getChatName(c, user?.id).toLowerCase();
      return name.includes(q);
    });
  }, [chats, search, user]);

  const handleSelect = (chat) => {
    setActiveChat(chat);
    onMobileSelect?.();
  };

  return (
    <div className="chat-list">
      <div className="chat-list__search">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Поиск чатов..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chat-list__items">
        {isLoadingChats ? (
          <div className="chat-list__loading">
            <span className="text-dim">Загрузка чатов</span>
            <span className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="chat-list__empty">
            <span className="text-dim">
              {search ? 'Ничего не найдено' : 'Пока нет чатов'}
            </span>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const name = getChatName(chat, user?.id);
            const avatarInfo = getChatAvatar(chat, user?.id);
            const isActive = activeChat?.id === chat.id;
            const lastMsg = chat.last_message;
            const unread = unreadCounts[chat.id] || 0;

            return (
              <div
                key={chat.id}
                className={`chat-item ${isActive ? 'chat-item--active' : ''}`}
                onClick={() => handleSelect(chat)}
              >
                <UserAvatar
                  name={avatarInfo.name}
                  userId={avatarInfo.userId}
                  size={44}
                />
                <div className="chat-item__info">
                  <div className="chat-item__top">
                    <span className="chat-item__name">{name}</span>
                    <span className="chat-item__time">
                      {formatTime(lastMsg?.created_at)}
                    </span>
                  </div>
                  <div className="chat-item__bottom">
                    <span className="chat-item__preview">
                      {lastMsg?.is_deleted
                        ? 'сообщение удалено'
                        : lastMsg?.content || ''}
                    </span>
                    {unread > 0 && (
                      <span className="chat-item__unread">{unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
