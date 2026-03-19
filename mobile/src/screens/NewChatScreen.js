import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useStore } from '../store/useStore';
import { searchUsers, createChat } from '../utils/api';

export default function NewChatScreen({ navigation }) {
  const [mode, setMode] = useState('private'); // 'private' | 'group'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState('');

  const debounceRef = useRef(null);
  const user = useStore((s) => s.user);

  const doSearch = useCallback(
    async (text) => {
      if (!text.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const data = await searchUsers(text.trim());
        // Filter out current user
        const filtered = data.filter((u) => u.id !== user?.id);
        setResults(filtered);
      } catch (err) {
        console.warn('Search failed:', err);
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleSearchChange = (text) => {
    setQuery(text);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      doSearch(text);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleUserTapPrivate = async (selectedUser) => {
    setCreating(true);
    try {
      const chat = await createChat('private', [selectedUser.id]);
      navigation.replace('Chat', { chat });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to create chat.';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const toggleUserSelection = (selectedUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === selectedUser.id);
      if (exists) {
        return prev.filter((u) => u.id !== selectedUser.id);
      }
      return [...prev, selectedUser];
    });
  };

  const isSelected = (userId) => {
    return selectedUsers.some((u) => u.id === userId);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }
    if (selectedUsers.length < 1) {
      Alert.alert('Error', 'Please select at least one member.');
      return;
    }

    setCreating(true);
    try {
      const memberIds = selectedUsers.map((u) => u.id);
      const chat = await createChat('group', memberIds, groupName.trim());
      navigation.replace('Chat', { chat });
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to create group.';
      Alert.alert('Error', msg);
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }) => {
    const avatar = (item.display_name || item.username || '?')
      .charAt(0)
      .toUpperCase();
    const selected = isSelected(item.id);

    return (
      <TouchableOpacity
        style={[styles.userItem, selected && styles.userItemSelected]}
        onPress={() => {
          if (mode === 'private') {
            handleUserTapPrivate(item);
          } else {
            toggleUserSelection(item);
          }
        }}
        activeOpacity={0.6}
        disabled={creating}
      >
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{avatar}</Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userDisplayName}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.userUsername}>@{item.username}</Text>
        </View>

        {mode === 'group' && (
          <View
            style={[styles.checkbox, selected && styles.checkboxSelected]}
          >
            {selected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (searching) return null;
    if (!query.trim()) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Search for users to start chatting.</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No users found.</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Mode tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, mode === 'private' && styles.tabActive]}
          onPress={() => {
            setMode('private');
            setSelectedUsers([]);
          }}
        >
          <Text
            style={[styles.tabText, mode === 'private' && styles.tabTextActive]}
          >
            Private
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'group' && styles.tabActive]}
          onPress={() => setMode('group')}
        >
          <Text
            style={[styles.tabText, mode === 'group' && styles.tabTextActive]}
          >
            Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Group name input */}
      {mode === 'group' && (
        <TextInput
          style={styles.groupNameInput}
          placeholder="group_name_"
          placeholderTextColor={COLORS.textDim}
          value={groupName}
          onChangeText={setGroupName}
          autoCorrect={false}
        />
      )}

      {/* Selected users chips */}
      {mode === 'group' && selectedUsers.length > 0 && (
        <View style={styles.selectedContainer}>
          {selectedUsers.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.selectedChip}
              onPress={() => toggleUserSelection(u)}
            >
              <Text style={styles.selectedChipText}>
                {u.display_name || u.username} x
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Search input */}
      <TextInput
        style={styles.searchInput}
        placeholder="search_users_"
        placeholderTextColor={COLORS.textDim}
        value={query}
        onChangeText={handleSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {searching && (
        <ActivityIndicator
          size="small"
          color={COLORS.green}
          style={styles.searchingIndicator}
        />
      )}

      {/* Results list */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderUserItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
      />

      {/* Create group button */}
      {mode === 'group' && selectedUsers.length > 0 && (
        <TouchableOpacity
          style={[styles.createGroupButton, creating && styles.buttonDisabled]}
          onPress={handleCreateGroup}
          disabled={creating}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator size="small" color={COLORS.bg} />
          ) : (
            <Text style={styles.createGroupText}>CREATE GROUP</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Loading overlay for private chat creation */}
      {creating && mode === 'private' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.overlayText}>Creating chat...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginHorizontal: 4,
    borderRadius: 4,
    backgroundColor: COLORS.bgSecondary,
  },
  tabActive: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.greenDark,
  },
  tabText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textDim,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.green,
  },
  groupNameInput: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.green,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: COLORS.bgSecondary,
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  selectedChip: {
    backgroundColor: COLORS.greenDark,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  selectedChipText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.green,
  },
  searchInput: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.green,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: COLORS.bgSecondary,
  },
  searchingIndicator: {
    marginVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userItemSelected: {
    backgroundColor: COLORS.bgTertiary,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.greenDark,
    borderWidth: 1,
    borderColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontFamily: FONTS.mono,
    fontSize: 18,
    color: COLORS.green,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userDisplayName: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  userUsername: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textDim,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.green,
  },
  checkmark: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.bg,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 70,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: 'center',
  },
  createGroupButton: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createGroupText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.bg,
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.green,
    marginTop: 12,
  },
});
