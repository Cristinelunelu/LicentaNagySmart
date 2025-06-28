import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { onValue, ref, set } from 'firebase/database';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { db } from '../../lib/firebaseConfig';
import { useTheme } from '../../lib/ThemeContext';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function LocationScreen() {
  const { theme } = useTheme();
  const [distance, setDistance] = useState<number | null>(null);
  const [homeCoords, setHomeCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [autoCheck, setAutoCheck] = useState(false);
  const [autoLamp, setAutoLamp] = useState(false);
  const [autoLed, setAutoLed] = useState(false);
  const [autoPriza, setAutoPriza] = useState(false);
  const [autoBarrier, setAutoBarrier] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [wasInHomeZone, setWasInHomeZone] = useState(false); 
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Firebase listener pentru coordonatele casei
  useEffect(() => {
    const homeRef = ref(db, 'home/location');
    const unsubscribe = onValue(homeRef, snapshot => {
      const val = snapshot.val();
      if (val?.latitude && val?.longitude) {
        setHomeCoords({ latitude: val.latitude, longitude: val.longitude });
      }
    });
    return () => unsubscribe();
  }, []);

  // Încărcarea setărilor din AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [savedAuto, lamp, led, priza, barrier, homeZone] = await Promise.all([
          AsyncStorage.getItem('autoCheckLocation'),
          AsyncStorage.getItem('autoLamp'),
          AsyncStorage.getItem('autoLed'),
          AsyncStorage.getItem('autoPriza'),
          AsyncStorage.getItem('autoBarrier'),
          AsyncStorage.getItem('wasInHomeZone') 
        ]);

        if (savedAuto !== null) setAutoCheck(savedAuto === 'true');
        if (lamp !== null) setAutoLamp(lamp === 'true');
        if (led !== null) setAutoLed(led === 'true');
        if (priza !== null) setAutoPriza(priza === 'true');
        if (barrier !== null) setAutoBarrier(barrier === 'true');
        if (homeZone !== null) setWasInHomeZone(homeZone === 'true'); 
      } catch (error) {
        console.error('Eroare la încărcarea setărilor:', error);
      }
    })();
  }, []); 

  // Salvarea setărilor
  useEffect(() => {
    AsyncStorage.setItem('autoCheckLocation', autoCheck.toString());
  }, [autoCheck]);

  useEffect(() => {
    AsyncStorage.setItem('autoLamp', autoLamp.toString());
  }, [autoLamp]);

  useEffect(() => {
    AsyncStorage.setItem('autoLed', autoLed.toString());
  }, [autoLed]);

  useEffect(() => {
    AsyncStorage.setItem('autoPriza', autoPriza.toString());
  }, [autoPriza]);

  useEffect(() => {
    AsyncStorage.setItem('autoBarrier', autoBarrier.toString());
  }, [autoBarrier]);

  // Interval pentru verificarea automată a locației
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (autoCheck && homeCoords) {
      interval = setInterval(() => {
        checkLocation();
        animatePulse();
      }, 10000); 
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoCheck, homeCoords]);

  const animatePulse = useCallback(() => {
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.ease,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
        easing: Easing.ease,
      }),
    ]).start();
  }, [animatedValue]);

  const checkLocation = useCallback(async () => {
    if (!homeCoords) {
      Alert.alert('Locația casei nu este setată');
      return;
    }

    if (isCheckingLocation) return;

    setIsCheckingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Eroare', 'Permisiunea pentru locație a fost refuzată');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });

      const { latitude, longitude } = location.coords;
      const d = getDistanceMeters(latitude, longitude, homeCoords.latitude, homeCoords.longitude);
      setDistance(d);

      const isInHomeZone = d < 150;

    
      if (isInHomeZone && !wasInHomeZone) {
        
        let actions: string[] = [];
        const promises: Promise<any>[] = [];
        
        if (autoLamp) {
          promises.push(set(ref(db, 'lamp/status/state'), 'ON'));
          actions.push('bec');
        }
        
        if (autoLed) {
          promises.push(set(ref(db, 'led/status/state'), 'ON'));
          actions.push('LED');
        }
        
        if (autoPriza) {
          promises.push(set(ref(db, 'priza/status/state'), 'ON'));
          actions.push('priză');
        }
        
        if (autoBarrier) {
          promises.push(set(ref(db, 'barrier/status/state'), 'OPEN'));
          actions.push('barieră');
        }

        if (promises.length > 0) {
          await Promise.all(promises);
          
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: ' Automatizare activată',
                body: `S-au activat: ${actions.join(', ')}`,
              },
              trigger: null,
            });
          } catch (notifError) {
            console.log('Notification error:', notifError);
          }

          Alert.alert(
            ' Automatizare activată', 
            `S-au activat: ${actions.join(', ')}\nDistanță: ${d.toFixed(1)} m`
          );
        }
        
        setWasInHomeZone(true); // Marchează că suntem în zona de automatizare
        
      } else if (!isInHomeZone && wasInHomeZone) {
        // Tocmai am ieșit din zona de automatizare
        setWasInHomeZone(false);
        console.log('Ai ieșit din zona de automatizare');
      }
      // Dacă isInHomeZone && wasInHomeZone = true -> nu face nimic (deja am activat)
      // Dacă !isInHomeZone && !wasInHomeZone = false -> nu face nimic (nu sunt în zonă)
      
    } catch (error) {
      console.error('Eroare la verificarea locației:', error);
      Alert.alert('Eroare', 'Nu s-a putut obține locația. Verifică conexiunea și permisiunile.');
    } finally {
      setIsCheckingLocation(false);
    }
  }, [homeCoords, autoLamp, autoLed, autoPriza, autoBarrier, isCheckingLocation, wasInHomeZone]);

  const saveCurrentLocationAsHome = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Eroare', 'Permisiunea pentru locație a fost refuzată');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const { latitude, longitude } = location.coords;
      await set(ref(db, 'home/location'), { latitude, longitude });
      
      Alert.alert('Locație setată', 'Locația curentă a fost salvată ca acasă');
    } catch (error) {
      console.error('Eroare la salvarea locației:', error);
      Alert.alert('Eroare', 'Nu s-a putut salva locația');
    }
  }, []);

  const pulseScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.cardTitle }]}>📍 Locație & Automatizare</Text>
      
      <View style={[styles.automationCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🤖 Automatizare</Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.activeDot }]}
          onPress={saveCurrentLocationAsHome}
        >
          <Text style={[styles.buttonText, { color: 'white' }]}>
            Setează locația curentă ca acasă
          </Text>
        </TouchableOpacity>

        <View style={[styles.switchCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.switchText, { color: theme.text }]}>
             Verificare automată locație
          </Text>
          <Switch
            value={autoCheck}
            onValueChange={setAutoCheck}
            trackColor={{ false: theme.darkModeTrack, true: theme.activeDot }}
            thumbColor={theme.switchThumb}
          />
        </View>

        <View style={[styles.switchCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.switchText, { color: theme.text }]}>
            💡 Auto activare bec
          </Text>
          <Switch
            value={autoLamp}
            onValueChange={setAutoLamp}
            trackColor={{ false: theme.darkModeTrack, true: theme.lamp }}
            thumbColor={theme.switchThumb}
          />
        </View>

        {/* Switch pentru LED */}
        <View style={[styles.switchCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.switchText, { color: theme.text }]}>
            🔆 Auto activare LED
          </Text>
          <Switch
            value={autoLed}
            onValueChange={setAutoLed}
            trackColor={{ false: theme.darkModeTrack, true: theme.led }}
            thumbColor={theme.switchThumb}
          />
        </View>

        {/* Switch pentru Priză */}
        <View style={[styles.switchCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.switchText, { color: theme.text }]}>
            🔌 Auto activare priză
          </Text>
          <Switch
            value={autoPriza}
            onValueChange={setAutoPriza}
            trackColor={{ false: theme.darkModeTrack, true: theme.lamp }}
            thumbColor={theme.switchThumb}
          />
        </View>

        <View style={[styles.switchCard, { backgroundColor: theme.background }]}>
          <Text style={[styles.switchText, { color: theme.text }]}>
            🚧 Auto deschidere barieră
          </Text>
          <Switch
            value={autoBarrier}
            onValueChange={setAutoBarrier}
            trackColor={{ false: theme.darkModeTrack, true: theme.barrier }}
            thumbColor={theme.switchThumb}
          />
        </View>

        <Animated.View style={[{ transform: [{ scale: pulseScale }] }]}>
          <TouchableOpacity 
            style={[
              styles.button, 
              { 
                backgroundColor: isCheckingLocation ? theme.darkModeTrack : theme.notifActive,
                opacity: isCheckingLocation ? 0.6 : 1
              }
            ]}
            onPress={checkLocation}
            disabled={isCheckingLocation}
          >
            <Text style={[styles.buttonText, { color: 'white' }]}>
              {isCheckingLocation ? '⏳ Verificare...' : '📍 Verifică locația acum'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {distance !== null && (
          <View style={[styles.infoCard, { backgroundColor: theme.background }]}>
            <Text style={[styles.distanceText, { color: theme.cardTitle }]}>
              📏 Distanță până acasă: {distance.toFixed(1)} m
            </Text>
            <Text style={[styles.statusText, { 
              color: distance < 150 ? theme.notifActive : theme.text 
            }]}>
              {distance < 150 ? '✅ În raza de automatizare' : '🔴 În afara razei'}
            </Text>
            {/* Status pentru debugging */}
            <Text style={[styles.debugText, { color: theme.text, marginTop: 8, fontSize: 12 }]}>
              Zone status: {wasInHomeZone ? '🏠 În zonă' : '🚗 În afara zonei'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 70,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  automationCard: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  switchText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  infoCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  debugText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});