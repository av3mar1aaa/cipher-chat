import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useStore } from '../store/useStore';
import { getChats } from '../utils/api';

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day}`;
}

function getChatDisplayName(chat, currentUserId) {
  if (chat.name) return chat.name;
  if (chat.type === 'private' && chat.members) {
    const other = chat.members.find((m) => m.id !== currentUserId);
    if (other) return other.display_name || other.username;
  }
  return 'Chat';
}

function getChatAvatar(chat, currentUserId) {
  const name = getChatDisplayName(chat, currentUserId);
  return name.charAt(0).toUpperCase();
}

export default function ChatListScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const chats = useStore((s) => s.chats);
  const setChats = useStore((s) => s.setChats);
  const connectWS = useStore((s) => s.connectWS);
  const user = useStore((s) => s.user);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'CIPHER CHAT',
      headerStyle: {
        backgroundColor: COLORS.bg,
        shadowColor: 'transparent',
        elevation: 0,
      },
      headerTintColor: COLORS.green,
      headerTitleStyle: {
        fontFamily: FONTS.mono,
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 1,
      },
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('NewChat')}
        >
          <Text style={styles.headerButtonText}>+</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => (
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.headerButtonIcon}>@</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data);
    } catch (err) {
      console.warn('Failed to fetch chats:', err);
    }
  }, [setChats]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchChats();
      connectWS();
      setLoading(false);
    };
    init();
  }, [fetchChats, connectWS]);

  // Re-fetch chats when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchChats();
    });
    return unsubscribe;
  }, [navigation, fetchChats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  }, [fetchChats]);

  const sortedChats = [...chats].sort((a, b) => {
    const aTime = a.last_message?.created_at || a.created_at || '';
    const bTime = b.last_message?.created_at || b.created_at || '';
    return bTime.localeCompare(aTime);
  });

  const renderChatItem = ({ item }) => {
    const displayName = getChatDisplayName(item, user?.id);
    const avatar = getChatAvatar(item, user?.id);
    const lastMsg = item.last_message;
    const preview = lastMsg
      ? lastMsg.type === 'image'
        ? '[Image]'
        : lastMsg.content || ''
      : 'No messages yet';
    const time = lastMsg
      ? formatTime(lastMsg.created_at)
      : formatTime(item.created_at);
    const unread = item.unread_count || 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { chat: item })}
        activeOpacity={0.6}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatar}</Text>
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatTopRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.chatTime}>{time}</Text>
          </View>
          <View style={styles.chatBottomRow}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {preview}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Пока нет чатов</Text>
        <Text style={styles.emptySubtext}>Начните общение</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Загрузка чатов...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedChats}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderChatItem}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.green}
            colors={[COLORS.green]}
          />
        }
        contentContainerStyle={sortedChats.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
        activeOpacity={0.7}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
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
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  headerButtonText: {
    fontFamily: FONTS.mono,
    fontSize: 24,
    color: COLORS.green,
    fontWeight: '700',
  },
  headerButtonIcon: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: COLORS.green,
    fontWeight: '700',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.greenDark,
    borderWidth: 1,
    borderColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontFamily: FONTS.mono,
    fontSize: 20,
    color: COLORS.green,
    fontWeight: '700',
  },
  chatInfo: {
    flex: 1,
  },
  chatTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textDim,
  },
  chatBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatPreview: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textDim,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.white,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 76,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: COLORS.greenDim,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtext: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontFamily: FONTS.mono,
    fontSize: 28,
    color: COLORS.bg,
    fontWeight: '700',
    marginTop: -2,
  },
});
