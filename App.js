import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, Image, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import OTsScreen from './src/screens/OTsScreen';
import OTDetailScreen from './src/screens/OTDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    console.log('[App] Iniciando...');
    checkLoginStatus();
    
    // Ocultar el Splash Screen después de 4 segundos
    setTimeout(() => {
      setIsSplashVisible(false);
    }, 4000);
  }, []);

  async function checkLoginStatus() {
    console.log('[App] Chequeando login status en AsyncStorage...');
    try {
      const nombre = await AsyncStorage.getItem('tecnico_nombre');
      console.log('[App] tecnico_nombre encontrado:', nombre);
      if (nombre) {
        setInitialRoute('OTs');
      } else {
        setInitialRoute('Login');
      }
    } catch (e) {
      console.error('[App] Error al chequear login:', e);
      setInitialRoute('Login');
    }
  }

  // Si todavía está en tiempo de Splash o no se ha resuelto la ruta
  if (isSplashVisible || initialRoute === null) {
    return (
      <View style={styles.splashContainer}>
        <Image 
          source={require('./assets/logo_inicio.jpg')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
        <ActivityIndicator size="large" color="#0066cc" style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OTs" component={OTsScreen} />
          <Stack.Screen name="OTDetail" component={OTDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#ffffff'
  },
  logo: {
    width: 250,
    height: 250,
  }
});
