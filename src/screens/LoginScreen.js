import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, Platform, ScrollView, ImageBackground, KeyboardAvoidingView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    console.log('[Login] Intentando iniciar sesión con:', email);
    if (!email || !password) {
      console.log('[Login] Faltan datos');
      Alert.alert('Datos Incompletos', 'Por favor ingresa correo electrónico y contraseña.');
      return;
    }
    setLoading(true);

    try {
      console.log('[Login] Consultando a Supabase...');
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password', password)
        .single();
      
      console.log('[Login] Respuesta Supabase:', { data, error });

      if (error || !data) {
        Alert.alert('Error de Acceso', 'Credenciales incorrectas o usuario no registrado.');
      } else {
        await AsyncStorage.setItem('tecnico_nombre', data.nombre);
        await AsyncStorage.setItem('tecnico_id', data.id.toString());
        if (data.foto_url) {
          await AsyncStorage.setItem('tecnico_foto', data.foto_url);
        } else {
          await AsyncStorage.removeItem('tecnico_foto');
        }
        navigation.replace('OTs');
      }
    } catch (err) {
      Alert.alert('Error del Servidor', 'Ocurrió un problema de red: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Render content
  const renderCardContent = () => (
    <View style={styles.loginCard}>
      <View style={styles.logoContainer}>
        <View style={styles.logoRing}>
          <Image 
            source={require('../../assets/logo_inicio.jpg')} 
            style={styles.logo} 
            resizeMode="cover" 
          />
        </View>
      </View>
      
      <Text style={styles.brandTitle}>CMMS Técnico</Text>
      <Text style={styles.brandSubtitle}>Plataforma de Control de Activos</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Correo Electrónico</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>✉️</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            placeholder="tecnico@ejemplo.com"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            onChangeText={setPassword}
            value={password}
            placeholder="••••••••"
            placeholderTextColor="rgba(255, 255, 255, 0.4)"
            secureTextEntry={true}
            autoCapitalize="none"
          />
        </View>
      </View>

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Acceder al Portal</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footerText}>Desarrollado para Equipos de Mantenimiento</Text>
    </View>
  );

  return (
    <ImageBackground 
      source={require('../../assets/pantallaf.jpg')} 
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {renderCardContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(10, 5, 25, 0.45)', // Sleek dark overlay to ensure readability
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 50,
  },
  loginCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(12, 10, 24, 0.82)', // Translucent deep violet
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(216, 0, 255, 0.25)', // Glowing neon purple border
    padding: 30,
    alignItems: 'stretch',
    shadowColor: '#d800ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(216, 0, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#d800ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#d800ff', // Match magenta neon lighting
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 30,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 12,
    color: '#a78bfa', // Lavender light text
    marginBottom: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 5, 20, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(216, 0, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 54,
    shadowColor: '#d800ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    color: '#d800ff',
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  button: {
    height: 54,
    backgroundColor: '#d800ff', // Neon purple accent button
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    shadowColor: '#d800ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 11,
    color: '#7c3aed', // Purple footer text
    textAlign: 'center',
    marginTop: 25,
    letterSpacing: 0.5,
  },
});
