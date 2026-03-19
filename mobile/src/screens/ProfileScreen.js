import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useStore } from '../store/useStore';

export default function ProfileScreen({ navigation }) {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const onlineUsers = useStore((s) => s.onlineUsers);

  const isOnline = user ? onlineUsers.includes(user.id) : false;
  const avatarLetter = (user?.display_name || user?.username || '?')
    .charAt(0)
    .toUpperCase();

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите отключиться?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>

        {/* User info */}
        <Text style={styles.displayName}>
          {user?.display_name || 'Unknown'}
        </Text>
        <Text style={styles.username}>@{user?.username || 'unknown'}</Text>

        {/* Online status */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? COLORS.green : COLORS.textDim },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isOnline ? COLORS.green : COLORS.textDim },
            ]}
          >
            {isOnline ? 'В сети' : 'Не в сети'}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Logout button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>ВЫЙТИ</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>CipherChat v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.greenDark,
    borderWidth: 2,
    borderColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    fontFamily: FONTS.mono,
    fontSize: 44,
    color: COLORS.green,
    fontWeight: '700',
  },
  displayName: {
    fontFamily: FONTS.mono,
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  username: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: COLORS.textDim,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 32,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: 40,
  },
  logoutText: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: '#ff4444',
    fontWeight: '700',
    letterSpacing: 1,
  },
  version: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textDim,
    position: 'absolute',
    bottom: 40,
  },
});
