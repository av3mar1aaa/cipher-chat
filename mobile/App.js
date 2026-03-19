import React, { useEffect, useState } from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useStore } from './src/store/useStore';
import { COLORS, FONTS } from './src/constants/theme';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatScreen from './src/screens/ChatScreen';
import NewChatScreen from './src/screens/NewChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

const cipherDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.bg,
    card: COLORS.bg,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.green,
  },
};

const globalScreenOptions = {
  headerStyle: {
    backgroundColor: COLORS.bg,
  },
  headerTintColor: COLORS.green,
  headerTitleStyle: {
    fontFamily: FONTS.mono,
  },
  headerShadowVisible: false,
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={globalScreenOptions}>
      <AuthStack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'CipherChat' }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Register' }}
      />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={globalScreenOptions}>
      <MainStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: 'CipherChat' }}
      />
      <MainStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <MainStack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{ title: 'Новый чат' }}
      />
      <MainStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Профиль' }}
      />
    </MainStack.Navigator>
  );
}

export default function App() {
  const token = useStore((state) => state.token);
  const loadToken = useStore((state) => state.loadToken);
  const connectWS = useStore((state) => state.connectWS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await loadToken();
      setLoading(false);
    }
    init();
  }, []);

  // Connect WebSocket when token becomes available
  useEffect(() => {
    if (token) {
      connectWS();
    }
  }, [token]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={cipherDarkTheme}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {token ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
