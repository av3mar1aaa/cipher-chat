import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';
import { useStore } from '../store/useStore';
import { login } from '../utils/api';

const ASCII_LOGO = `
 ██████╗██╗██████╗ ██╗  ██╗███████╗██████╗
██╔════╝██║██╔══██╗██║  ██║██╔════╝██╔══██╗
██║     ██║██████╔╝███████║█████╗  ██████╔╝
██║     ██║██╔═══╝ ██╔══██║██╔══╝  ██╔══██╗
╚██████╗██║██║     ██║  ██║███████╗██║  ██║
 ╚═════╝╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
          ██████╗██╗  ██╗ █████╗ ████████╗
         ██╔════╝██║  ██║██╔══██╗╚══██╔══╝
         ██║     ███████║███████║   ██║
         ██║     ██╔══██║██╔══██║   ██║
         ╚██████╗██║  ██║██║  ██║   ██║
          ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
`.trim();

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const storeLogin = useStore((s) => s.login);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Все поля обязательны для заполнения.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await login(username.trim(), password);
      await storeLogin(data.token, data.user);
      navigation.replace('ChatList');
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Ошибка входа. Проверьте ваши учётные данные.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.asciiLogo}>{ASCII_LOGO}</Text>

        <View style={styles.form}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="имя_пользователя"
            placeholderTextColor={COLORS.textDim}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="пароль"
            placeholderTextColor={COLORS.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.bg} size="small" />
            ) : (
              <Text style={styles.buttonText}>ВОЙТИ В СИСТЕМУ</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Создать аккаунт</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  asciiLogo: {
    fontFamily: FONTS.mono,
    fontSize: 6,
    color: COLORS.green,
    textAlign: 'center',
    lineHeight: 8,
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  error: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  input: {
    fontFamily: FONTS.mono,
    fontSize: 15,
    color: COLORS.green,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: COLORS.bgSecondary,
  },
  button: {
    backgroundColor: COLORS.green,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FONTS.mono,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.bg,
    letterSpacing: 1,
  },
  link: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.greenDim,
    textDecorationLine: 'underline',
  },
});
