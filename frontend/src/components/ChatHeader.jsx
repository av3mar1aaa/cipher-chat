import useStore from '../store/useStore';
import UserAvatar from './UserAvatar';
import { FiArrowLeft, FiMoreVertical } from 'react-icons/fi';

function getChatName(chat, currentUserId) {
  if (chat.name) return chat.name;
  if (chat.type === 'private' && chat.participants) {
    const other = chat.participants.find((p) => p.id !== currentUserId);
    return other?.display_name || other?.username || 'Неизвестный';
  }
  return 'Чат';
}

function getOtherUser(chat, currentUserId) {
  if (chat.type === 'private' && chat.participants) {
    return chat.participants.find((p) => p.id !== currentUserId);
  }
  return null;
}

export default function ChatHeader({ onBack }) {
  const { activeChat, user, onlineUsers } = useStore();

  if (!activeChat) return null;

  const chatName = getChatName(activeChat, user?.id);
  const otherUser = getOtherUser(activeChat, user?.id);
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const memberCount = activeChat.participants?.length || 0;

  return (
    <div className="chat-header">
      <button className="icon-btn back-btn" onClick={onBack}>
        <FiArrowLeft />
      </button>

      <UserAvatar
        name={chatName}
        userId={otherUser?.id}
        size={38}
      />

      <div className="chat-header__info">
        <span className="chat-header__name">{chatName}</span>
        <span className="chat-header__status">
          {activeChat.type === 'group' ? (
            <>{memberCount} участников</>
          ) : isOnline ? (
            <span className="status-online">в сети</span>
          ) : (
            <span className="text-dim">не в сети</span>
          )}
        </span>
      </div>

      <div className="chat-header__actions">
        <button className="icon-btn">
          <FiMoreVertical />
        </button>
      </div>
    </div>
  );
}
