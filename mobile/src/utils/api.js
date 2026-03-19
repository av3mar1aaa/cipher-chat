import axios from 'axios';
import { useStore } from '../store/useStore';

// ============================================================
// CONFIGURATION - Change these to match your server IP address
// ============================================================
export const CONFIG = {
  API_URL: 'http://YOUR_SERVER_IP:8000/api',
  WS_URL: 'ws://YOUR_SERVER_IP:8000/ws',
};

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth interceptor - attaches token from store to every request
api.interceptors.request.use((config) => {
  const token = useStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Auth ----

export async function login(username, password) {
  const { data } = await api.post('/auth/login/', { username, password });
  return data;
}

export async function register(username, password, displayName) {
  const { data } = await api.post('/auth/register/', {
    username,
    password,
    display_name: displayName,
  });
  return data;
}

// ---- Chats ----

export async function getChats() {
  const { data } = await api.get('/chats/');
  return data;
}

export async function createChat(type, memberIds, name) {
  const payload = { type, member_ids: memberIds };
  if (name) {
    payload.name = name;
  }
  const { data } = await api.post('/chats/', payload);
  return data;
}

export async function getMembers(chatId) {
  const { data } = await api.get(`/chats/${chatId}/members/`);
  return data;
}

// ---- Messages ----

export async function getMessages(chatId, beforeId) {
  const params = {};
  if (beforeId) {
    params.before = beforeId;
  }
  const { data } = await api.get(`/chats/${chatId}/messages/`, { params });
  return data;
}

export async function sendMessage(chatId, content, type, fileUrl) {
  const payload = { content };
  if (type) {
    payload.type = type;
  }
  if (fileUrl) {
    payload.file_url = fileUrl;
  }
  const { data } = await api.post(`/chats/${chatId}/messages/`, payload);
  return data;
}

export async function deleteMessage(messageId) {
  const { data } = await api.delete(`/messages/${messageId}/`);
  return data;
}

export async function markRead(messageId) {
  const { data } = await api.post(`/messages/${messageId}/read/`);
  return data;
}

// ---- Users ----

export async function searchUsers(query) {
  const { data } = await api.get('/users/search/', { params: { q: query } });
  return data;
}

// ---- Files ----

export async function uploadFile(uri, filename) {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: filename,
    type: 'application/octet-stream',
  });

  const { data } = await api.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export default api;
