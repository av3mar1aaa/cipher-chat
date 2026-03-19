import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import ChatList from '../components/ChatList';
import ChatHeader from '../components/ChatHeader';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import NewChatModal from '../components/NewChatModal';
import { FiPlus, FiLogOut, FiSettings } from 'react-icons/fi';
import UserAvatar from '../components/UserAvatar';

export default function ChatPage() {
  const navigate = useNavigate();
  const {
    user,
    chats,
    activeChat,
    messages,
    isLoadingChats,
    isLoadingMessages,
    typingUsers,
    fetchChats,
    logout,
    hydrate,
  } = useStore();

  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (activeChat) {
      setMobileSidebarOpen(false);
    }
  }, [activeChat]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const typingInfo = activeChat ? typingUsers[activeChat.id] : null;

  return (
    <div className="chat-page">
      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileSidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header__left">
            <span className="logo-text glitch" data-text="CIPHER">
              CIPHER<span className="logo-accent">CHAT</span>
            </span>
          </div>
          <div className="sidebar-header__right">
            <UserAvatar
              name={user?.display_name || user?.username || '?'}
              size={32}
              online={true}
            />
            <button
              className="icon-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <FiLogOut />
            </button>
          </div>
        </div>

        <div className="sidebar-actions">
          <button
            className="new-chat-btn"
            onClick={() => setShowNewChat(true)}
          >
            <FiPlus /> NEW TRANSMISSION
          </button>
        </div>

        <ChatList onMobileSelect={() => setMobileSidebarOpen(false)} />
      </aside>

      {/* MAIN CHAT AREA */}
      <main
        className={`chat-main ${!mobileSidebarOpen ? 'chat-main--open' : ''}`}
      >
        {activeChat ? (
          <>
            <ChatHeader onBack={() => setMobileSidebarOpen(true)} />

            <div className="messages-area" id="messages-area">
              {isLoadingMessages ? (
                <div className="messages-loading">
                  <div className="terminal-loader">
                    <span>DECRYPTING MESSAGES</span>
                    <span className="loading-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="messages-empty">
                  <div className="empty-icon">&gt;_</div>
                  <p>No messages yet.</p>
                  <p className="text-dim">
                    Start the encrypted conversation...
                  </p>
                </div>
              ) : (
                <div className="messages-list">
                  {messages.map((msg, i) => {
                    const prevMsg = i > 0 ? messages[i - 1] : null;
                    const showAvatar =
                      !prevMsg || prevMsg.sender_id !== msg.sender_id;
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isOwn={msg.sender_id === user?.id}
                        showAvatar={showAvatar}
                      />
                    );
                  })}
                  <div id="messages-bottom" />
                </div>
              )}

              {typingInfo && (
                <div className="typing-indicator">
                  <span className="typing-name">{typingInfo.username}</span>
                  <span className="text-dim"> is typing</span>
                  <span className="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </div>
              )}
            </div>

            <MessageInput />
          </>
        ) : (
          <div className="no-chat-selected">
            <pre className="no-chat-ascii">{`
   ______ _       _               _____ _           _
  / _____) |     | |             / ____) |         | |
 | /     | |____ | | ____  ___ | /    | |____ ____| |_
 | |     |  ___ \\| |/ _  |/ _ \\| |    |  ___ |/ _  | __)
 | \\____ | | | | | | |_| | |_| | \\____| | | ( ( | | |
  \\______) |_| |_|_|  ____|\\___/ \\_____)_| |_|\\_||_|\\___)
                    |_|
`}</pre>
            <p className="text-dim">
              Select a chat or start a new transmission
            </p>
            <button
              className="new-chat-btn"
              onClick={() => setShowNewChat(true)}
            >
              <FiPlus /> NEW TRANSMISSION
            </button>
          </div>
        )}
      </main>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
    </div>
  );
}
