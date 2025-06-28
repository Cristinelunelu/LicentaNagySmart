import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { get, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView, Platform,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View
} from 'react-native';
import { db } from '../lib/firebaseConfig';
import { useTheme } from '../lib/ThemeContext';

export default function LoginScreen() {
  const { theme } = useTheme();
  const [deviceCode, setDeviceCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Verifică dacă utilizatorul este deja logat
  useEffect(() => {
    checkExistingLogin();
  }, []);

  const checkExistingLogin = async () => {
    try {
      const savedCode = await AsyncStorage.getItem('deviceCode');
      if (savedCode) {
        // Verifică dacă codul salvat este încă valid în Firebase
        const isValid = await verifyCodeWithFirebase(savedCode);
        if (isValid) {
          router.replace('/(tabs)');
        } else {
          // Șterge codul invalid
          await AsyncStorage.removeItem('deviceCode');
        }
      }
    } catch (error) {
      console.error('Error checking login:', error);
    }
  };

  const verifyCodeWithFirebase = async (code: string): Promise<boolean> => {
    try {
      const snapshot = await get(ref(db, 'config/accessKey'));
      const firebaseKey = snapshot.val();
      return firebaseKey === code;
    } catch (error) {
      console.error('Error verifying with Firebase:', error);
      return false;
    }
  };

  const handleLogin = async () => {
    if (!deviceCode.trim()) {
      Alert.alert('Eroare', 'Introduceți codul dispozitivului');
      return;
    }

    setIsLoading(true);
    
    try {
      // Verifică codul exact cu Firebase
      const isValid = await verifyCodeWithFirebase(deviceCode.toUpperCase());
      
      if (isValid) {
        // Salvează codul local
        await AsyncStorage.setItem('deviceCode', deviceCode.toUpperCase());
        Alert.alert('Succes', 'Conectat cu succes!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)') }
        ]);
      } else {
        Alert.alert('Eroare', 'Cod invalid! Verificați codul din Firebase.');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Eroare', 'Nu s-a putut verifica codul. Verificați conexiunea.');
    } finally {
      setIsLoading(false);
    }
  };

  const showHelp = () => {
    Alert.alert(
      'Cum obțin codul?', 
      '1. Deschideți Firebase Console\n2. Mergeți la Realtime Database\n3. Găsiți config/accessKey\n4. Copiați valoarea (ex: SMART2025)',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>
           Smart Home
        </Text>
        
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Conectează-te cu cheia de acces
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.label, { color: theme.text }]}>
             Cheie de acces:
          </Text>
          
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.inputBg || '#f5f5f5',
              color: theme.text,
              borderColor: theme.inputBorder || '#ddd'
            }]}
            value={deviceCode}
            onChangeText={setDeviceCode}
            placeholder="Introduceți cheia din Firebase"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.activeDot || '#4A90E2' }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? '⏳ Se verifică...' : '🔐 Conectează'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.helpButton, { backgroundColor: theme.cardItemBg || '#f0f0f0' }]}
            onPress={showHelp}
          >
            <Text style={[styles.helpText, { color: theme.text }]}>
               Cum obțin codul?
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.instruction, { color: theme.textSecondary }]}>
          Cheia se găsește în Firebase → config → accessKey
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  helpText: {
    fontSize: 14,
  },
  instruction: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
});