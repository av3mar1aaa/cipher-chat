import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, FONTS } from '../constants/theme';
import { useStore } from '../store/useStore';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  markRead,
  uploadFile,
} from '../utils/api';

function formatMessageTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function getChatDisplayName(chat, currentUserId) {
  if (chat.name) return chat.name;
  if (chat.type === 'private' && chat.members) {
    const other = chat.members.find((m) => m.id !== currentUserId);
    if (other) return other.display_name || other.username;
  }
  return 'Chat';
}

export default function ChatScreen({ route, navigation }) {
  const { chat } = route.params;

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [imagePreview, setImagePreview] = useState(null);

  const flatListRef = useRef(null);
  const lastTypingSent = useRef(0);

  const user = useStore((s) => s.user);
  const messages = useStore((s) => s.messages);
  const setMessages = useStore((s) => s.setMessages);
  const setActiveChat = useStore((s) => s.setActiveChat);
  const ws = useStore((s) => s.ws);
  const typingUsers = useStore((s) => s.typingUsers);
  const onlineUsers = useStore((s) => s.onlineUsers);

  const chatTyping = typingUsers[chat.id] || [];
  const typingFiltered = chatTyping.filter((id) => id !== user?.id);

  // Determine online status for private chats
  const isPrivate = chat.type === 'private';
  let otherUser = null;
  if (isPrivate && chat.members) {
    otherUser = chat.members.find((m) => m.id !== user?.id);
  }
  const isOnline = otherUser ? onlineUsers.includes(otherUser.id) : false;
  const displayName = getChatDisplayName(chat, user?.id);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: COLORS.bg,
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: COLORS.green,
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {displayName}
          </Text>
          {isPrivate && (
            <View style={styles.headerStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? COLORS.green : COLORS.textDim },
                ]}
              />
              <Text style={styles.headerStatus}>
                {isOnline ? 'online' : 'offline'}
              </Text>
            </View>
          )}
        </View>
      ),
    });
  }, [navigation, displayName, isOnline, isPrivate]);

  const fetchMessages = useCallback(async (beforeId) => {
    try {
      const data = await getMessages(chat.id, beforeId);
      return data;
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
      return [];
    }
  }, [chat.id]);

  // Initial load
  useEffect(() => {
    setActiveChat(chat);

    const init = async () => {
      setLoading(true);
      const data = await fetchMessages();
      setMessages(data);
      setHasMore(data.length >= 20);
      setLoading(false);

      // Mark last message as read
      if (data.length > 0) {
        const lastMsg = data[data.length - 1];
        if (lastMsg.sender_id !== user?.id) {
          try {
            await markRead(lastMsg.id);
          } catch (err) {
            // Silently fail
          }
        }
      }
    };

    init();

    return () => {
      setActiveChat(null);
    };
  }, [chat, fetchMessages, setActiveChat, setMessages, user?.id]);

  // Mark new messages as read
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender_id !== user?.id && !lastMsg.is_read) {
        markRead(lastMsg.id).catch(() => {});
      }
    }
  }, [messages, user?.id]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !imagePreview) return;

    setSending(true);

    try {
      if (imagePreview) {
        const uploadResult = await uploadFile(
          imagePreview,
          `image_${Date.now()}.jpg`
        );
        await sendMessage(chat.id, text || '', 'image', uploadResult.url);
        setImagePreview(null);
      } else {
        await sendMessage(chat.id, text);
      }
      setInputText('');
    } catch (err) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImagePreview(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
    }
  };

  const handleDeleteMessage = (messageId) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(messageId);
          } catch (err) {
            Alert.alert('Error', 'Failed to delete message.');
          }
        },
      },
    ]);
  };

  const handleTextChange = (text) => {
    setInputText(text);

    // Send typing indicator (throttled)
    const now = Date.now();
    if (ws && now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      try {
        ws.send(
          JSON.stringify({
            type: 'typing',
            chat_id: chat.id,
          })
        );
      } catch (err) {
        // WS might be closed
      }
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    setLoadingMore(true);
    const oldestMsg = messages[0];
    const olderMessages = await fetchMessages(oldestMsg.id);

    if (olderMessages.length === 0) {
      setHasMore(false);
    } else {
      setMessages([...olderMessages, ...messages]);
      setHasMore(olderMessages.length >= 20);
    }
    setLoadingMore(false);
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.sender_id === user?.id;
    const isImage = item.type === 'image';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => {
          if (isOwn) {
            handleDeleteMessage(item.id);
          }
        }}
        style={[
          styles.messageBubbleWrapper,
          isOwn ? styles.ownMessageWrapper : styles.otherMessageWrapper,
        ]}
      >
        {!isOwn && chat.type === 'group' && (
          <Text style={styles.senderName}>
            {item.sender_display_name || item.sender_username || 'User'}
          </Text>
        )}

        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          {isImage && item.file_url ? (
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Image', item.file_url);
              }}
            >
              <Image
                source={{ uri: item.file_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : null}

          {item.content ? (
            <Text style={styles.messageText}>{item.content}</Text>
          ) : null}

          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {formatMessageTime(item.created_at)}
            </Text>
            {isOwn && (
              <Text style={styles.readStatus}>
                {item.is_read ? '\u2713\u2713' : '\u2713'}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTypingIndicator = () => {
    if (typingFiltered.length === 0) return null;
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>someone is typing...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Decrypting messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.messagesList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={COLORS.green}
              style={styles.loadingMore}
            />
          ) : null
        }
        ListHeaderComponent={renderTypingIndicator}
      />

      {imagePreview && (
        <View style={styles.imagePreviewContainer}>
          <Image
            source={{ uri: imagePreview }}
            style={styles.imagePreviewThumb}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.imagePreviewRemove}
            onPress={() => setImagePreview(null)}
          >
            <Text style={styles.imagePreviewRemoveText}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handlePickImage}
          activeOpacity={0.6}
        >
          <Text style={styles.attachButtonText}>{'\u{1F4CE}'}</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type message..."
          placeholderTextColor={COLORS.textDim}
          value={inputText}
          onChangeText={handleTextChange}
          multiline
          maxLength={2000}
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputText.trim() && !imagePreview) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={(!inputText.trim() && !imagePreview) || sending}
          activeOpacity={0.6}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.bg} />
          ) : (
            <Text style={styles.sendButtonText}>{'\u2191'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textDim,
    marginTop: 12,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    color: COLORS.green,
    fontWeight: '700',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  headerStatus: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textDim,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageBubbleWrapper: {
    marginVertical: 3,
    maxWidth: '80%',
  },
  ownMessageWrapper: {
    alignSelf: 'flex-end',
  },
  otherMessageWrapper: {
    alignSelf: 'flex-start',
  },
  senderName: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.greenDim,
    marginBottom: 2,
    marginLeft: 8,
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  ownBubble: {
    backgroundColor: '#0a1f0a',
    borderColor: COLORS.greenDark,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.bgTertiary,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textDim,
  },
  readStatus: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.greenDim,
    marginLeft: 4,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typingText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.greenDim,
    fontStyle: 'italic',
  },
  loadingMore: {
    paddingVertical: 12,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  imagePreviewThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.green,
  },
  imagePreviewRemove: {
    marginLeft: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewRemoveText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  attachButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.green,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 100,
    backgroundColor: COLORS.bg,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.greenDark,
    opacity: 0.5,
  },
  sendButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    color: COLORS.bg,
    fontWeight: '700',
  },
});
