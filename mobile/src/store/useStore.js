import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../utils/api';

const TOKEN_KEY = 'cipher_chat_token';
const USER_KEY = 'cipher_chat_user';

let reconnectTimer = null;

export const useStore = create((set, get) => ({
  // ---- State ----
  token: null,
  user: null,
  chats: [],
  activeChat: null,
  messages: [],
  onlineUsers: [],
  typingUsers: {},
  ws: null,

  // ---- Auth Actions ----

  login: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    const { ws } = get();
    if (ws) {
      ws.close();
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({
      token: null,
      user: null,
      chats: [],
      activeChat: null,
      messages: [],
      onlineUsers: [],
      typingUsers: {},
      ws: null,
    });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ token, user });
        return true;
      }
    } catch (e) {
      console.warn('Failed to load token from SecureStore:', e);
    }
    return false;
  },

  // ---- Chat Actions ----

  setChats: (chats) => set({ chats }),

  setActiveChat: (chat) => set({ activeChat: chat }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => {
    const { activeChat, messages, chats } = get();

    // Update messages list if the message belongs to the active chat
    if (activeChat && message.chat_id === activeChat.id) {
      set({ messages: [...messages, message] });
    }

    // Update the chat's last_message in the chats list
    const updatedChats = chats.map((chat) => {
      if (chat.id === message.chat_id) {
        return { ...chat, last_message: message };
      }
      return chat;
    });
    set({ chats: updatedChats });
  },

  removeMessage: (messageId) => {
    const { messages } = get();
    set({ messages: messages.filter((m) => m.id !== messageId) });
  },

  updateUnread: (chatId, count) => {
    const { chats } = get();
    const updatedChats = chats.map((chat) => {
      if (chat.id === chatId) {
        return { ...chat, unread_count: count };
      }
      return chat;
    });
    set({ chats: updatedChats });
  },

  // ---- WebSocket Actions ----

  connectWS: () => {
    const { token, ws: existingWs } = get();
    if (!token) return;

    // Close existing connection if any
    if (existingWs) {
      existingWs.close();
    }

    const wsUrl = `${CONFIG.WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WS] Connected');
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;

        switch (type) {
          case 'init': {
            const onlineIds = data.online_users || [];
            set({ onlineUsers: onlineIds });
            break;
          }

          case 'new_message': {
            get().addMessage(data.message);
            break;
          }

          case 'message_deleted': {
            get().removeMessage(data.message_id);
            break;
          }

          case 'typing': {
            const { typingUsers } = get();
            const chatTyping = typingUsers[data.chat_id] || [];
            if (!chatTyping.includes(data.user_id)) {
              set({
                typingUsers: {
                  ...typingUsers,
                  [data.chat_id]: [...chatTyping, data.user_id],
                },
              });
            }
            // Auto-remove typing indicator after 3 seconds
            setTimeout(() => {
              const { typingUsers: current } = get();
              const list = current[data.chat_id] || [];
              set({
                typingUsers: {
                  ...current,
                  [data.chat_id]: list.filter((id) => id !== data.user_id),
                },
              });
            }, 3000);
            break;
          }

          case 'read_receipt': {
            const { activeChat } = get();
            if (activeChat && data.chat_id === activeChat.id) {
              const { messages } = get();
              const updatedMessages = messages.map((msg) => {
                if (msg.id <= data.message_id && msg.sender_id !== data.user_id) {
                  return { ...msg, is_read: true };
                }
                return msg;
              });
              set({ messages: updatedMessages });
            }
            if (data.chat_id) {
              get().updateUnread(data.chat_id, 0);
            }
            break;
          }

          case 'user_online': {
            const { onlineUsers } = get();
            if (!onlineUsers.includes(data.user_id)) {
              set({ onlineUsers: [...onlineUsers, data.user_id] });
            }
            break;
          }

          case 'user_offline': {
            const { onlineUsers } = get();
            set({
              onlineUsers: onlineUsers.filter((id) => id !== data.user_id),
            });
            break;
          }

          default:
            console.log('[WS] Unhandled message type:', type);
        }
      } catch (e) {
        console.warn('[WS] Failed to parse message:', e);
      }
    };

    ws.onerror = (error) => {
      console.warn('[WS] Error:', error.message);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
      set({ ws: null });

      // Auto-reconnect after 3 seconds if still logged in
      const { token: currentToken } = get();
      if (currentToken) {
        reconnectTimer = setTimeout(() => {
          console.log('[WS] Attempting reconnect...');
          get().connectWS();
        }, 3000);
      }
    };

    set({ ws });
  },

  disconnectWS: () => {
    const { ws } = get();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  },
}));
