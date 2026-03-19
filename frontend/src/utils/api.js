import axios from 'axios';

const instance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

let _token = null;

export function setToken(token) {
  _token = token;
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete instance.defaults.headers.common['Authorization'];
  }
}

// Intercept 401 to auto-logout
instance.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Will be handled by the component
    }
    return Promise.reject(err);
  }
);

// --- Auth ---

export async function login(username, password) {
  // Backend expects form data for OAuth2
  const form = new URLSearchParams();
  form.append('username', username);
  form.append('password', password);
  const { data } = await instance.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function register(username, password, displayName) {
  const { data } = await instance.post('/auth/register', {
    username,
    password,
    display_name: displayName,
  });
  return data;
}

// --- Chats ---

export async function getChats() {
  const { data } = await instance.get('/chats');
  return data;
}

export async function createChat(payload) {
  // payload: { type: "private" | "group", participant_ids: [...], name?: "..." }
  const { data } = await instance.post('/chats', payload);
  return data;
}

export async function getChatById(chatId) {
  const { data } = await instance.get(`/chats/${chatId}`);
  return data;
}

// --- Messages ---

export async function getMessages(chatId, limit = 50, offset = 0) {
  const { data } = await instance.get(`/chats/${chatId}/messages`, {
    params: { limit, offset },
  });
  return data;
}

export async function sendMessage(chatId, content, replyTo = null) {
  const { data } = await instance.post(`/chats/${chatId}/messages`, {
    content,
    reply_to: replyTo,
  });
  return data;
}

export async function deleteMessage(chatId, messageId) {
  const { data } = await instance.delete(
    `/chats/${chatId}/messages/${messageId}`
  );
  return data;
}

// --- Users ---

export async function searchUsers(query) {
  const { data } = await instance.get('/users/search', {
    params: { q: query },
  });
  return data;
}

export async function getMe() {
  const { data } = await instance.get('/users/me');
  return data;
}

// --- Files ---

export async function uploadFile(chatId, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await instance.post(`/chats/${chatId}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export default instance;
