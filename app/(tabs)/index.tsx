import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { get, onValue, ref, set } from 'firebase/database';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../lib/firebaseConfig';
import { useTheme } from '../../lib/ThemeContext';


export default function IndexScreen() {
  const { theme, isDarkMode, toggleDarkMode } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [doorNotificationsEnabled, setDoorNotificationsEnabled] = useState(true);
  const [gasNotificationsEnabled, setGasNotificationsEnabled] = useState(true);
  const [ledStatus, setLedStatus] = useState<'ON' | 'OFF'>('OFF');
  const [barrierStatus, setBarrierStatus] = useState<'OPEN' | 'CLOSE'>('CLOSE');
  const [lampStatus, setLampStatus] = useState<'ON' | 'OFF'>('OFF');
  const [doorStatus, setDoorStatus] = useState<'OPEN' | 'CLOSED'>('CLOSED');
  const [prizaStatus, setPrizaStatus] = useState<'ON' | 'OFF'>('OFF'); 
  const [motionStatus, setMotionStatus] = useState<'YES' | 'NO'>('NO');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [gasLevel, setGasLevel] = useState<number | null>(null);
  const [temperatureHistory, setTemperatureHistory] = useState<{ time: number, value: number }[]>([]);
  const [humidityHistory, setHumidityHistory] = useState<{ time: number, value: number }[]>([]);

  // Loading states pentru a preveni click-uri rapide
  const [isToggling, setIsToggling] = useState({
    led: false,
    barrier: false,
    lamp: false,
    priza: false 
  });

  // RFID states
  const [rfidStatus, setRfidStatus] = useState<'WAITING' | 'DETECTED' | 'AUTHORIZED' | 'DENIED' | 'REGISTERING'>('WAITING');
  const [lastRfidCard, setLastRfidCard] = useState<string | null>(null);
  const [authorizedUser, setAuthorizedUser] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredCards, setRegisteredCards] = useState<{[key: string]: {name: string, access: boolean}}>({});

  const [barrierAutoCloseTime, setBarrierAutoCloseTime] = useState(15); // secunde
  const [barrierTimeoutId, setBarrierTimeoutId] = useState<number | null>(null);

  // Inițializări din AsyncStorage - DOAR pentru notificări
  useEffect(() => {
    registerForPushNotificationsAsync();

    (async () => {
      try {
        const [notif, doorNotif, gasNotif, barrierTime] = await Promise.all([
          AsyncStorage.getItem('notificationsEnabled'),
          AsyncStorage.getItem('doorNotificationsEnabled'),
          AsyncStorage.getItem('gasNotificationsEnabled'),
          AsyncStorage.getItem('barrierAutoCloseTime')
        ]);

        if (notif !== null) setNotificationsEnabled(notif === 'true');
        if (doorNotif !== null) setDoorNotificationsEnabled(doorNotif === 'true');
        if (gasNotif !== null) setGasNotificationsEnabled(gasNotif === 'true');
        if (barrierTime !== null) setBarrierAutoCloseTime(parseInt(barrierTime));
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    })();
  }, []);

  // Firebase listeners 
  useEffect(() => {
    // LED Listener
    const unsubscribeLed = onValue(ref(db, 'led/status/state'), s => {
      const v = s.val();
      console.log('LED Firebase value:', v); // Debug
      if (v === 'ON' || v === 'OFF') {
        setLedStatus(v);
        // Salvează în AsyncStorage doar pentru cache, nu pentru state
        AsyncStorage.setItem('ledStatus', v).catch(console.error);
      }
    });

    // Barrier Listener
    const unsubscribeBarrier = onValue(ref(db, 'barrier/status/state'), s => {
      const v = s.val();
      console.log('Barrier Firebase value:', v); // Debug
      if (v === 'OPEN' || v === 'CLOSE') {
        setBarrierStatus(v);
        AsyncStorage.setItem('barrierStatus', v).catch(console.error);
      }
    });

    // Lamp Listener
    const unsubscribeLamp = onValue(ref(db, 'lamp/status/state'), s => {
      const v = s.val();
      console.log('Lamp Firebase value:', v); // Debug
      if (v === 'ON' || v === 'OFF') {
        setLampStatus(v);
        AsyncStorage.setItem('lampStatus', v).catch(console.error);
      }
    });

    // Door Listener
    const unsubscribeDoor = onValue(ref(db, 'sensors/door/status'), s => {
      const v = s.val();
      console.log('Door Firebase value:', v); // Debug
      if (v === 'OPEN' || v === 'CLOSED') {
        setDoorStatus(v);
        AsyncStorage.setItem('doorStatus', v).catch(console.error);
        
        // Trimite notificare pentru deschiderea ușii
        if (v === 'OPEN' && doorNotificationsEnabled) {
          Notifications.scheduleNotificationAsync({
            content: { 
              title: ' Ușa a fost deschisă!',
              body: 'Senzorul magnetic a detectat deschiderea ușii!',
            },
            trigger: null,
          }).catch(console.error);
        }
      }
    });

    // Priza Listener 
    const unsubscribePriza = onValue(ref(db, 'priza/status/state'), s => {
      const v = s.val();
      console.log('Priza Firebase value:', v);
      if (v === 'ON' || v === 'OFF') {
        setPrizaStatus(v);
        AsyncStorage.setItem('prizaStatus', v).catch(console.error);
      }
    });

    // Environment listeners
    const unsubscribeTemp = onValue(ref(db, 'environment/temperature'), s => {
      const v = s.val();
      if (typeof v === 'number') setTemperature(v);
    });

    const unsubscribeHumidity = onValue(ref(db, 'environment/humidity'), s => {
      const v = s.val();
      if (typeof v === 'number') setHumidity(v);
    });

    const unsubscribeGas = onValue(ref(db, 'environment/gas'), s => {
      const v = s.val();
      if (typeof v === 'number') {
        setGasLevel(v);
        
        // Notificare pentru nivel periculos de gaze
        if (v > 800 && gasNotificationsEnabled) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: ' PERICOL - Nivel ridicat de gaze!',
              body: `Nivelul gazelor a ajuns la ${v} ppm! Verificați imediat!`,
            },
            trigger: null,
          }).catch(console.error);
        }
      }
    });

    // History listeners
    const unsubscribeTempHistory = onValue(ref(db, 'history/temperature'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const entries = Object.entries(data)
          .map(([timestamp, value]) => ({ 
            time: parseInt(timestamp), 
            value: parseFloat(value as string) 
          }))
          .sort((a, b) => a.time - b.time)
          .slice(-10);
        setTemperatureHistory(entries);
      }
    });

    const unsubscribeHumidityHistory = onValue(ref(db, 'history/humidity'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const entries = Object.entries(data)
          .map(([timestamp, value]) => ({ 
            time: parseInt(timestamp), 
            value: parseFloat(value as string) 
          }))
          .sort((a, b) => a.time - b.time)
          .slice(-10);
        setHumidityHistory(entries);
      }
    });

    // RFID Listeners
    const unsubscribeRfidStatus = onValue(ref(db, 'rfid/status'), s => {
      const v = s.val();
      if (v && ['WAITING', 'DETECTED', 'AUTHORIZED', 'DENIED', 'REGISTERING'].includes(v)) {
        setRfidStatus(v);
        
        // Auto-deschide și auto-închide bariera după autorizare
        if (v === 'AUTHORIZED') {
          // Deschide bariera
          set(ref(db, 'barrier/status/state'), 'OPEN').then(() => {
            // Anulează timeout-ul anterior dacă există
            if (barrierTimeoutId) {
              clearTimeout(barrierTimeoutId);
            }
            
            // Setează noul timeout pentru auto-închidere
            const timeoutId = setTimeout(async () => {
              try {
                console.log(`Auto-closing barrier after RFID authorization in ${barrierAutoCloseTime} seconds`);
                await set(ref(db, 'barrier/status/state'), 'CLOSE');
                setBarrierTimeoutId(null);
              } catch (error) {
                console.error('Error auto-closing barrier after RFID:', error);
              }
            }, barrierAutoCloseTime * 1000);
            
            setBarrierTimeoutId(timeoutId);
          }).catch(error => {
            console.error('Error opening barrier after RFID:', error);
          });
        }
      }
    });

    const unsubscribeRfidCard = onValue(ref(db, 'rfid/lastCard'), s => {
      const v = s.val();
      if (v) setLastRfidCard(v);
    });

    const unsubscribeRfidUser = onValue(ref(db, 'rfid/authorizedUser'), s => {
      const v = s.val();
      setAuthorizedUser(v);
    });

    const unsubscribeRegisteredCards = onValue(ref(db, 'rfid/authorizedCards'), s => {
      const v = s.val();
      setRegisteredCards(v || {}); 
    });

    const unsubscribeRegistering = onValue(ref(db, 'rfid/isRegistering'), s => {
      const v = s.val();
      setIsRegistering(v === true);
    });

    return () => {
      unsubscribeLed();
      unsubscribeBarrier();
      unsubscribeLamp();
      unsubscribeDoor();
      unsubscribePriza();  
      unsubscribeTemp();
      unsubscribeHumidity();
      unsubscribeGas();
      unsubscribeTempHistory();
      unsubscribeHumidityHistory();
      unsubscribeRfidStatus();
      unsubscribeRfidCard();
      unsubscribeRfidUser();
      unsubscribeRegisteredCards();
      unsubscribeRegistering();
    };
  }, [doorNotificationsEnabled, gasNotificationsEnabled, barrierAutoCloseTime, barrierTimeoutId]);

  // Motion listener 
  useEffect(() => {
    const unsubscribeMotion = onValue(ref(db, 'motion/status'), snapshot => {
      const val = snapshot.val();
      if (val === 'YES' || val === 'NO') {
        setMotionStatus(val);
        if (val === 'YES' && notificationsEnabled) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: ' Mișcare detectată!',
              body: 'A fost detectată prezență în casă!',
            },
            trigger: null,
          }).catch(console.error);
        }
      }
    });

    return () => unsubscribeMotion();
  }, [notificationsEnabled]);

  // Notification toggles
  const toggleNotifications = useCallback(async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem('notificationsEnabled', val.toString());
  }, []);

  const toggleDoorNotifications = useCallback(async (val: boolean) => {
    setDoorNotificationsEnabled(val);
    await AsyncStorage.setItem('doorNotificationsEnabled', val.toString());
  }, []);

  const toggleGasNotifications = useCallback(async (val: boolean) => {
    setGasNotificationsEnabled(val);
    await AsyncStorage.setItem('gasNotificationsEnabled', val.toString());
  }, []);

  // Funcții de toggle pentru dispozitive
  const toggleLed = useCallback(async (value: boolean) => {
    if (isToggling.led) return; // Previne click-uri rapide
    
    setIsToggling(prev => ({ ...prev, led: true }));
    
    try {
      const newValue = value ? 'ON' : 'OFF';
      console.log('Toggling LED to:', newValue); // Debug
      
      // Trimite doar la Firebase, listener-ul va actualiza state-ul
      await set(ref(db, 'led/status/state'), newValue);
      
    } catch (error) {
      console.error('Error toggling LED:', error);
      // În caz de eroare, Firebase listener va restabili starea corectă
    } finally {
      // Debounce timp scurt
      setTimeout(() => {
        setIsToggling(prev => ({ ...prev, led: false }));
      }, 500);
    }
  }, [isToggling.led]);

  const toggleBarrier = useCallback(async (value: boolean) => {
    if (isToggling.barrier) return;
    
    setIsToggling(prev => ({ ...prev, barrier: true }));
    
    try {
      const newValue = value ? 'OPEN' : 'CLOSE';
      console.log('Toggling Barrier to:', newValue); // Debug
      await set(ref(db, 'barrier/status/state'), newValue);
      
      // Dacă bariera se deschide, setează timer pentru auto-închidere
      if (value) {
        // Anulează timeout-ul anterior dacă există
        if (barrierTimeoutId) {
          clearTimeout(barrierTimeoutId);
        }
        
        // Setează noul timeout
        const timeoutId = setTimeout(async () => {
          try {
            console.log(`Auto-closing barrier after ${barrierAutoCloseTime} seconds`);
            await set(ref(db, 'barrier/status/state'), 'CLOSE');
            setBarrierTimeoutId(null);
          } catch (error) {
            console.error('Error auto-closing barrier:', error);
          }
        }, barrierAutoCloseTime * 1000);
        
        setBarrierTimeoutId(timeoutId);
      } else {
        // Dacă se închide manual, anulează timeout-ul
        if (barrierTimeoutId) {
          clearTimeout(barrierTimeoutId);
          setBarrierTimeoutId(null);
        }
      }
      
    } catch (error) {
      console.error('Error toggling Barrier:', error);
    } finally {
      setTimeout(() => {
        setIsToggling(prev => ({ ...prev, barrier: false }));
      }, 500);
    }
  }, [isToggling.barrier, barrierAutoCloseTime, barrierTimeoutId]);

  const toggleLamp = useCallback(async (value: boolean) => {
    if (isToggling.lamp) return;
    
    setIsToggling(prev => ({ ...prev, lamp: true }));
    
    try {
      const newValue = value ? 'ON' : 'OFF';
      console.log('Toggling Lamp to:', newValue); // Debug
      await set(ref(db, 'lamp/status/state'), newValue);
    } catch (error) {
      console.error('Error toggling Lamp:', error);
    } finally {
      setTimeout(() => {
        setIsToggling(prev => ({ ...prev, lamp: false }));
      }, 500);
    }
  }, [isToggling.lamp]);

  // Priza toggle function 
  const togglePriza = useCallback(async (value: boolean) => {
    if (isToggling.priza) return;
    
    setIsToggling(prev => ({ ...prev, priza: true }));
    
    try {
      const newValue = value ? 'ON' : 'OFF';
      console.log('Toggling Priza to:', newValue);
      await set(ref(db, 'priza/status/state'), newValue);
    } catch (error) {
      console.error('Error toggling Priza:', error);
    } finally {
      setTimeout(() => {
        setIsToggling(prev => ({ ...prev, priza: false }));
      }, 500);
    }
  }, [isToggling.priza]);

  // RFID control functions
  const startCardRegistration = useCallback(async () => {
    try {
      await set(ref(db, 'rfid/isRegistering'), true);
      await set(ref(db, 'rfid/status'), 'REGISTERING');
    } catch (error) {
      console.error('Error starting registration:', error);
    }
  }, []);

  const stopCardRegistration = useCallback(async () => {
    try {
      await set(ref(db, 'rfid/isRegistering'), false);
      await set(ref(db, 'rfid/status'), 'WAITING');
    } catch (error) {
      console.error('Error stopping registration:', error);
    }
  }, []);

  const removeCard = useCallback(async (cardId: string) => {
    try {
      await set(ref(db, `rfid/authorizedCards/${cardId}`), null);
    } catch (error) {
      console.error('Error removing card:', error);
    }
  }, []);

  // Editare carduri
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const startEditCard = useCallback((cardId: string, currentName: string) => {
    setEditingCard(cardId);
    setEditingName(currentName);
  }, []);

  const saveCardName = useCallback(async (cardId: string) => {
    if (editingName.trim().length === 0) {
      Alert.alert('Eroare', 'Numele nu poate fi gol');
      return;
    }
    
    try {
      await set(ref(db, `rfid/authorizedCards/${cardId}/name`), editingName.trim());
      setEditingCard(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating card name:', error);
      Alert.alert('Eroare', 'Nu s-a putut actualiza numele cardului');
    }
  }, [editingName]);

  const cancelEdit = useCallback(() => {
    setEditingCard(null);
    setEditingName('');
  }, []);

  // Funcție pentru actualizarea timpului de auto-închidere:
  const updateBarrierAutoCloseTime = useCallback(async (seconds: number) => {
    if (seconds < 5 || seconds > 120) {
      Alert.alert('Eroare', 'Timpul trebuie să fie între 5 și 120 secunde');
      return;
    }
    
    setBarrierAutoCloseTime(seconds);
    await AsyncStorage.setItem('barrierAutoCloseTime', seconds.toString());
  }, []);

  // Autentificare și verificare acces
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const deviceCode = await AsyncStorage.getItem('deviceCode');
      if (!deviceCode) {
        router.replace('/login');
        return;
      }
      
      // Verifică dacă codul este încă valid în Firebase
      const snapshot = await get(ref(db, 'config/accessKey'));
      const firebaseKey = snapshot.val();
      
      if (firebaseKey !== deviceCode) {
        await AsyncStorage.removeItem('deviceCode');
        router.replace('/login');
        return;
      }
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/login');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Deconectare',
      'Sigur vreți să vă deconectați?',
      [
        { text: 'Anulează', style: 'cancel' },
        { 
          text: 'Deconectează', 
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('deviceCode');
              router.replace('/login');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Eroare', 'Nu s-a putut efectua deconectarea');
            }
          }
        }
      ]
    );
  };

  // Loading screen
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}> Verificare acces...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.wrapper, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView 
        contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
        style={{ backgroundColor: theme.background }}
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="always"
        keyboardShouldPersistTaps="handled" // Important pentru a putea atinge butoanele
      >
        <Text style={[styles.title, { color: theme.text }]}> Smart Home Dashboard</Text>

        {/* LED */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>LED 💡</Text>
          <Switch
            value={ledStatus === 'ON'}
            onValueChange={toggleLed}
            disabled={isToggling.led}
            trackColor={{ false: '#aaa', true: theme.led }}
            thumbColor={theme.switchThumb}
          />
          <Text style={[styles.status, { color: theme.text }]}>
            Status: {ledStatus} {isToggling.led ? '⏳' : ''}
          </Text>
        </View>

        {/* Barieră */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Barieră 🚧</Text>
          <Switch
            value={barrierStatus === 'OPEN'}
            onValueChange={toggleBarrier}
            disabled={isToggling.barrier}
            trackColor={{ false: '#aaa', true: theme.barrier }}
            thumbColor={theme.switchThumb}
          />
          <Text style={[styles.status, { color: theme.text }]}>
            Status: {barrierStatus} {isToggling.barrier ? '⏳' : ''}
          </Text>
          
          {barrierStatus === 'OPEN' && barrierTimeoutId && (
            <Text style={[styles.autoCloseText, { color: theme.textSecondary }]}>
              Se va închide automat în {barrierAutoCloseTime} secunde
            </Text>
          )}
          
          {/* Control timp auto-închidere */}
          <View style={styles.barrierTimeControl}>
            <Text style={[styles.timeLabel, { color: theme.text }]}>
               Auto-închidere după: {barrierAutoCloseTime} secunde
            </Text>
            
            <View style={styles.timeButtons}>
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.cardItemBg }]}
                onPress={() => updateBarrierAutoCloseTime(5)}
              >
                <Text style={[styles.timeButtonText, { color: theme.text }]}>5s</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.cardItemBg }]}
                onPress={() => updateBarrierAutoCloseTime(10)}
              >
                <Text style={[styles.timeButtonText, { color: theme.text }]}>10s</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.cardItemBg }]}
                onPress={() => updateBarrierAutoCloseTime(15)}
              >
                <Text style={[styles.timeButtonText, { color: theme.text }]}>15s</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.timeButton, { backgroundColor: theme.cardItemBg }]}
                onPress={() => updateBarrierAutoCloseTime(30)}
              >
                <Text style={[styles.timeButtonText, { color: theme.text }]}>30s</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bec */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Bec 💡</Text>
          <Switch
            value={lampStatus === 'ON'}
            onValueChange={toggleLamp}
            disabled={isToggling.lamp}
            trackColor={{ false: '#aaa', true: theme.lamp }}
            thumbColor={theme.switchThumb}
          />
          <Text style={[styles.status, { color: theme.text }]}>
            Status: {lampStatus} {isToggling.lamp ? '⏳' : ''}
          </Text>
        </View>

        {/* Priză */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Priză 🔌</Text>
          <Switch
            value={prizaStatus === 'ON'}
            onValueChange={togglePriza}
            disabled={isToggling.priza}
            trackColor={{ false: '#aaa', true: theme.lamp }}
            thumbColor={theme.switchThumb}
          />
          <Text style={[styles.status, { color: theme.text }]}>
            Status: {prizaStatus} {isToggling.priza ? '⏳' : ''}
          </Text>
        </View>

        {/* Temperatură & Umiditate */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Temperatură & Umiditate 🌡️</Text>
          <Text style={{ color: theme.text }}>Temperatură: {temperature ?? '...'} °C</Text>
          <Text style={{ color: theme.text }}>Umiditate: {humidity ?? '...'} %</Text>
        </View>

        {/* Mișcare */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Mișcare</Text>
          <Text style={[styles.motionStatus, { 
            backgroundColor: motionStatus === 'YES' ? theme.detected : theme.notDetected,
            color: theme.text,
          }]}>
            {motionStatus === 'YES' ? 'Mișcare detectată' : 'Fără mișcare'}
          </Text>
          
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 15,
            paddingTop: 15,
            borderTopWidth: 1,
            borderTopColor: theme.text + '20'
          }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Notificări mișcare:</Text>
            <Switch 
              value={notificationsEnabled} 
              onValueChange={toggleNotifications}
              trackColor={{ false: theme.darkModeTrack, true: theme.notifActive }}
              thumbColor={theme.switchThumb}
            />
          </View>
        </View>

        {/* Senzor Ușă */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Senzor Ușă 🚪</Text>
          <Text style={[
            styles.motionStatus,
            {
              backgroundColor: doorStatus === 'OPEN' ? theme.doorOpen : theme.doorClosed,
              color: 'white',
            },
          ]}>
            {doorStatus === 'OPEN' ? 'Ușa este DESCHISĂ' : 'Ușa este ÎNCHISĂ'}
          </Text>
          <Text style={[styles.status, { color: theme.text }]}>
            Status: {doorStatus}
          </Text>
          
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 15,
            paddingTop: 15,
            borderTopWidth: 1,
            borderTopColor: theme.text + '20'
          }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Notificări ușă:</Text>
            <Switch 
              value={doorNotificationsEnabled} 
              onValueChange={toggleDoorNotifications}
              trackColor={{ false: theme.darkModeTrack, true: theme.notifActive }}
              thumbColor={theme.switchThumb}
            />
          </View>
        </View>

        {/* Senzor Gaze */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Senzor Gaze 💨</Text>
          
          <View style={styles.sensorRow}>
            <Text style={[styles.sensorText, { color: theme.text }]}>
               Nivel gaze: {gasLevel !== null ? `${gasLevel} ppm` : '...'}
            </Text>
            {gasLevel !== null && (
              <View style={[
                styles.gasIndicator,
                {
                  backgroundColor: 
                    gasLevel > 960 ? '#f44336' :   // Periculos (roșu) - threshold 960
                    gasLevel > 800 ? '#ff9800' :   // Atenție (portocaliu)
                    gasLevel > 600 ? '#ffeb3b' :   // Moderat (galben)
                    '#4CAF50'                      // Sigur (verde)
                }
              ]}>
                <Text style={[styles.gasIndicatorText, {
                  color: gasLevel > 600 ? '#000' : '#fff'
                }]}>
                  {gasLevel > 960 ? '🚨 PERICOL' :
                   gasLevel > 800 ? '⚠️ ATENȚIE' :
                   gasLevel > 600 ? '🟡 MODERAT' :
                   '✅ SIGUR'}
                </Text>
              </View>
            )}
          </View>
          
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 15,
            paddingTop: 15,
            borderTopWidth: 1,
            borderTopColor: theme.text + '20'
          }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Notificări gaze ({'>'}960ppm):</Text>
            <Switch 
              value={gasNotificationsEnabled} 
              onValueChange={toggleGasNotifications}
              trackColor={{ false: theme.darkModeTrack, true: theme.notifActive }}
              thumbColor={theme.switchThumb}
            />
          </View>
        </View>

        {/* Dark Mode */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>Mod întunecat și deconectare</Text>
          
          {/* Dark Mode Switch */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 15 
          }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>Dark Mode:</Text>
            <Switch 
              value={isDarkMode} 
              onValueChange={toggleDarkMode}
              trackColor={{ false: theme.darkModeTrack, true: theme.activeDot }}
              thumbColor={theme.switchThumb}
            />
          </View>
          
          {/* Logout Button */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: '#f44336' }]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>Deconectare</Text>
          </TouchableOpacity>
        </View>

        {/* RFID Reader */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>RFID Reader</Text>
          
          <View style={[
            styles.rfidStatus,
            {
              backgroundColor: 
                rfidStatus === 'AUTHORIZED' ? '#4CAF50' :
                rfidStatus === 'DENIED' ? '#f44336' :
                rfidStatus === 'DETECTED' ? '#ff9800' :
                rfidStatus === 'REGISTERING' ? '#2196F3' : '#757575'
            }
          ]}>
            <Text style={styles.rfidStatusText}>
              {rfidStatus === 'AUTHORIZED' ? 'Acces autorizat - Bariera se deschide' :
               rfidStatus === 'DENIED' ? 'Card neautorizat' :
               rfidStatus === 'DETECTED' ? 'Card detectat' :
               rfidStatus === 'REGISTERING' ? 'Mod înregistrare - Atingeți cardul' : 
               'Așteptare card'}
            </Text>
          </View>
          
          {authorizedUser && rfidStatus === 'AUTHORIZED' && (
            <Text style={[styles.status, { color: theme.text, fontWeight: 'bold' }]}>
              Utilizator: {authorizedUser}
            </Text>
          )}
          
          {lastRfidCard && (
            <Text style={[styles.status, { color: theme.text }]}>
              Ultimul card: {lastRfidCard.substring(0, 8)}...
            </Text>
          )}

          {/* Butoane control */}
          <View style={styles.rfidControls}>
            <TouchableOpacity
              style={[
                styles.rfidButton,
                { 
                  backgroundColor: isRegistering ? '#f44336' : '#4CAF50',
                  opacity: rfidStatus === 'DETECTED' ? 0.6 : 1
                }
              ]}
              onPress={isRegistering ? stopCardRegistration : startCardRegistration}
              disabled={rfidStatus === 'DETECTED'}
            >
              <Text style={styles.rfidButtonText}>
                {isRegistering ? '🛑 Stop înregistrare' : '➕ Înregistrează card nou'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista carduri înregistrate */}
          {Object.keys(registeredCards).length > 0 && (
            <View style={styles.registeredCards}>
              <Text style={[styles.cardSubtitle, { color: theme.cardTitle }]}>
                 Carduri înregistrate ({Object.keys(registeredCards).length}):
              </Text>
              {Object.entries(registeredCards).map(([cardId, cardInfo]) => (
                <View key={cardId} style={[styles.cardItem, 
                  { backgroundColor: theme.cardItemBg }
                ]}>
                  <View style={{ flex: 1 }}>
                    {editingCard === cardId ? (
                      <View style={styles.editContainer}>
                        <TextInput
                          style={[
                            styles.editInput,
                            { 
                              backgroundColor: theme.inputBg,
                              color: theme.text,
                              borderColor: theme.inputBorder
                            }
                          ]}
                          value={editingName}
                          onChangeText={setEditingName}
                          placeholder="Numele deținătorului"
                          placeholderTextColor={theme.text + '60'}
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                          onSubmitEditing={() => saveCardName(cardId)}
                          blurOnSubmit={true}
                        />
                        <View style={styles.editButtons}>
                          <TouchableOpacity
                            style={[styles.editButton, { backgroundColor: '#4CAF50' }]
                            }
                            onPress={() => saveCardName(cardId)}
                          >
                            <Text style={styles.editButtonText}>✅</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.editButton, { backgroundColor: '#f44336' }]}
                            onPress={cancelEdit}
                          >
                            <Text style={styles.editButtonText}>❌</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => startEditCard(cardId, cardInfo.name)}
                        style={styles.cardInfoContainer}
                      >
                        <Text style={[styles.cardName, { color: theme.text }]}>
                           {cardInfo.name}
                        </Text>
                        <Text style={[styles.cardId, { color: theme.textSecondary }]}>
                           {cardId.substring(0, 8)}...
                        </Text>
                        <Text style={[styles.editHint, { color: theme.textSecondary }]}>
                          Atinge pentru a edita
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {editingCard !== cardId && (
                    <TouchableOpacity
                      style={[styles.removeButton, { backgroundColor: '#ff4444' }]}
                      onPress={() => {
                        Alert.alert(
                          'Șterge Card',
                          `Sigur vreți să ștergeți cardul "${cardInfo.name}"?`,
                          [
                            { 
                              text: 'Anulează', 
                              style: 'cancel' 
                            },
                            { 
                              text: 'Șterge', 
                              style: 'destructive',
                              onPress: () => removeCard(cardId)
                            }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.removeButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

async function registerForPushNotificationsAsync() {
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Permisiune notificări refuzată');
    }
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  status: {
    marginTop: 10,
    fontSize: 16,
  },
  motionStatus: {
    fontSize: 18,
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    fontWeight: 'bold',
  },
  wrapper: {
    flex: 1,
  },
  rfidStatus: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
  },
  rfidStatusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rfidControls: {
    marginTop: 15,
  },
  rfidButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  rfidButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registeredCards: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  cardSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cardInfoContainer: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardId: {
    fontSize: 13,
    marginBottom: 2,
  },
  editHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  editContainer: {
    flex: 1,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 8,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 40,
    alignItems: 'center',
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  removeButtonText: {
    fontSize: 18,
    color: 'white',
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sensorText: {
    fontSize: 16,
  },
  gasIndicator: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    marginLeft: 10,
  },
  gasIndicatorText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  autoCloseText: {
    marginTop: 8,
    fontSize: 14,
    fontStyle: 'italic',
  },
  barrierTimeControl: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  timeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeButton: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
  },
  timeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  helpText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});