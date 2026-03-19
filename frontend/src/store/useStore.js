import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '../utils/api';

const useStore = create(
  persist(
    (set, get) => ({
      // --- state ---
      user: null,
      token: null,
      chats: [],
      activeChat: null,
      messages: [],
      onlineUsers: new Set(),
      ws: null,
      typingUsers: {},
      unreadCounts: {},
      isLoadingChats: false,
      isLoadingMessages: false,

      // --- auth ---
      login: async (username, password) => {
        const data = await api.login(username, password);
        set({ user: data.user, token: data.access_token });
        api.setToken(data.access_token);
        get().connectWS();
        return data;
      },

      register: async (username, password, displayName) => {
        const data = await api.register(username, password, displayName);
        set({ user: data.user, token: data.access_token });
        api.setToken(data.access_token);
        get().connectWS();
        return data;
      },

      logout: () => {
        const ws = get().ws;
        if (ws) ws.close();
        set({
          user: null,
          token: null,
          chats: [],
          activeChat: null,
          messages: [],
          onlineUsers: new Set(),
          ws: null,
          typingUsers: {},
          unreadCounts: {},
        });
        api.setToken(null);
      },

      // --- chats ---
      fetchChats: async () => {
        set({ isLoadingChats: true });
        try {
          const chats = await api.getChats();
          set({ chats, isLoadingChats: false });
        } catch (e) {
          set({ isLoadingChats: false });
          throw e;
        }
      },

      setActiveChat: async (chat) => {
        set({ activeChat: chat, messages: [], isLoadingMessages: true });
        try {
          const messages = await api.getMessages(chat.id);
          set({ messages, isLoadingMessages: false });
          // mark as read
          get().markChatRead(chat.id);
        } catch (e) {
          set({ isLoadingMessages: false });
        }
      },

      setChats: (chats) => set({ chats }),

      // --- messages ---
      setMessages: (messages) => set({ messages }),

      addMessage: (message) => {
        const { activeChat, messages, chats, unreadCounts } = get();

        // Update messages if this belongs to active chat
        if (activeChat && message.chat_id === activeChat.id) {
          set({ messages: [...messages, message] });
          // Mark as read
          get().markChatRead(activeChat.id);
        } else {
          // Increment unread count
          const newUnread = { ...unreadCounts };
          newUnread[message.chat_id] = (newUnread[message.chat_id] || 0) + 1;
          set({ unreadCounts: newUnread });
        }

        // Update chat's last message
        const updatedChats = chats.map((c) => {
          if (c.id === message.chat_id) {
            return { ...c, last_message: message };
          }
          return c;
        });
        // Sort chats: most recent first
        updatedChats.sort((a, b) => {
          const ta = a.last_message?.created_at || a.created_at || '';
          const tb = b.last_message?.created_at || b.created_at || '';
          return tb.localeCompare(ta);
        });
        set({ chats: updatedChats });
      },

      deleteMessage: (messageId) => {
        const { messages } = get();
        set({
          messages: messages.map((m) =>
            m.id === messageId ? { ...m, is_deleted: true, content: '' } : m
          ),
        });
      },

      markChatRead: (chatId) => {
        const { ws, unreadCounts } = get();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'mark_read', chat_id: chatId }));
        }
        const newUnread = { ...unreadCounts };
        delete newUnread[chatId];
        set({ unreadCounts: newUnread });
      },

      sendTyping: (chatId) => {
        const { ws } = get();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'typing', chat_id: chatId }));
        }
      },

      // --- online ---
      setOnlineUsers: (userIds) => {
        set({ onlineUsers: new Set(userIds) });
      },

      // --- WebSocket ---
      connectWS: () => {
        const { token } = get();
        if (!token) return;

        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = window.location.host;
        const wsUrl = `${proto}://${host}/ws?token=${token}`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS] Connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            get().handleWSMessage(data);
          } catch (e) {
            console.error('[WS] Parse error', e);
          }
        };

        ws.onclose = (e) => {
          console.log('[WS] Disconnected', e.code);
          set({ ws: null });
          // Reconnect after 3 seconds if we still have a token
          if (get().token) {
            setTimeout(() => {
              if (get().token && !get().ws) {
                get().connectWS();
              }
            }, 3000);
          }
        };

        ws.onerror = (e) => {
          console.error('[WS] Error', e);
        };

        set({ ws });
      },

      handleWSMessage: (data) => {
        switch (data.type) {
          case 'new_message':
            get().addMessage(data.message);
            break;

          case 'message_deleted':
            get().deleteMessage(data.message_id);
            break;

          case 'message_read':
            // Update read status of messages
            {
              const { messages } = get();
              set({
                messages: messages.map((m) =>
                  m.id === data.message_id ? { ...m, is_read: true } : m
                ),
              });
            }
            break;

          case 'user_online':
            {
              const online = new Set(get().onlineUsers);
              online.add(data.user_id);
              set({ onlineUsers: online });
            }
            break;

          case 'user_offline':
            {
              const online = new Set(get().onlineUsers);
              online.delete(data.user_id);
              set({ onlineUsers: online });
            }
            break;

          case 'online_users':
            get().setOnlineUsers(data.user_ids || []);
            break;

          case 'typing':
            {
              const { typingUsers, user } = get();
              if (data.user_id === user?.id) break;
              const chatTyping = { ...typingUsers };
              chatTyping[data.chat_id] = {
                userId: data.user_id,
                username: data.username,
                timestamp: Date.now(),
              };
              set({ typingUsers: chatTyping });
              // Clear typing after 3s
              setTimeout(() => {
                const current = get().typingUsers[data.chat_id];
                if (current && Date.now() - current.timestamp >= 3000) {
                  const updated = { ...get().typingUsers };
                  delete updated[data.chat_id];
                  set({ typingUsers: updated });
                }
              }, 3000);
            }
            break;

          case 'chat_created':
            {
              const { chats } = get();
              if (!chats.find((c) => c.id === data.chat.id)) {
                set({ chats: [data.chat, ...chats] });
              }
            }
            break;

          default:
            console.log('[WS] Unhandled message type:', data.type);
        }
      },

      // --- hydrate on reload ---
      hydrate: () => {
        const { token } = get();
        if (token) {
          api.setToken(token);
          get().connectWS();
          get().fetchChats();
        }
      },
    }),
    {
      name: 'cipher-chat-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
    }
  )
);

export default useStore;
