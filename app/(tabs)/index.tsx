// IndexScreen.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { onValue, ref, set } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db } from '../../lib/firebaseConfig';

const lightTheme = {
  background: '#F9F9F9',
  card: '#fff',
  text: '#333',
  cardTitle: '#444',
  switchThumb: '#eee',
  led: '#4CAF50',
  barrier: '#2196F3',
  lamp: '#FFD600',
  detected: '#FFCDD2',
  notDetected: '#C8E6C9',
};

const darkTheme = {
  background: '#121212',
  card: '#1E1E1E',
  text: '#E0E0E0',
  cardTitle: '#FFFFFF',
  switchThumb: '#444',
  led: '#81C784',
  barrier: '#64B5F6',
  lamp: '#FFEB3B',
  detected: '#EF9A9A',
  notDetected: '#A5D6A7',
};

export default function IndexScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const theme = isDarkMode ? darkTheme : lightTheme;

  const [ledStatus, setLedStatus] = useState<'ON' | 'OFF'>('OFF');
  const [barrierStatus, setBarrierStatus] = useState<'OPEN' | 'CLOSE'>('CLOSE');
  const [lampStatus, setLampStatus] = useState<'ON' | 'OFF'>('OFF');
  const [motionStatus, setMotionStatus] = useState<'YES' | 'NO'>('NO');
  const [temperature, setTemperature] = useState<number | null>(null);
  const [humidity, setHumidity] = useState<number | null>(null);
  const [temperatureHistory, setTemperatureHistory] = useState<number[]>([]);
  const [humidityHistory, setHumidityHistory] = useState<number[]>([]);

  useEffect(() => {
    registerForPushNotificationsAsync();

    (async () => {
      const dark = await AsyncStorage.getItem('darkMode');
      if (dark !== null) setIsDarkMode(dark === 'true');

      const notif = await AsyncStorage.getItem('notificationsEnabled');
      if (notif !== null) setNotificationsEnabled(notif === 'true');

      const storedLed = await AsyncStorage.getItem('ledStatus');
      if (storedLed === 'ON' || storedLed === 'OFF') setLedStatus(storedLed);

      const storedBarrier = await AsyncStorage.getItem('barrierStatus');
      if (storedBarrier === 'OPEN' || storedBarrier === 'CLOSE') setBarrierStatus(storedBarrier);

      const storedLamp = await AsyncStorage.getItem('lampStatus');
      if (storedLamp === 'ON' || storedLamp === 'OFF') setLampStatus(storedLamp);
    })();
  }, []);

  useEffect(() => {
    onValue(ref(db, 'led/status/state'), s => {
      const v = s.val();
      if (v === 'ON' || v === 'OFF') {
        setLedStatus(v);
        AsyncStorage.setItem('ledStatus', v);
      }
    });

    onValue(ref(db, 'barrier/status/state'), s => {
      const v = s.val();
      if (v === 'OPEN' || v === 'CLOSE') {
        setBarrierStatus(v);
        AsyncStorage.setItem('barrierStatus', v);
      }
    });

    onValue(ref(db, 'lamp/status/state'), s => {
      const v = s.val();
      if (v === 'ON' || v === 'OFF') {
        setLampStatus(v);
        AsyncStorage.setItem('lampStatus', v);
      }
    });

    onValue(ref(db, 'environment/temperature'), s => {
      const v = s.val();
      if (typeof v === 'number') setTemperature(v);
    });

    onValue(ref(db, 'environment/humidity'), s => {
      const v = s.val();
      if (typeof v === 'number') setHumidity(v);
    });

    onValue(ref(db, 'history/temperature'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const values = Object.values(data).map((v: any) => parseFloat(v)).slice(-10);
        setTemperatureHistory(values);
      }
    });

    onValue(ref(db, 'history/humidity'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const values = Object.values(data).map((v: any) => parseFloat(v)).slice(-10);
        setHumidityHistory(values);
      }
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, 'motion/status'), snapshot => {
      const val = snapshot.val();
      if (val === 'YES' || val === 'NO') {
        setMotionStatus(val);
        if (val === 'YES' && notificationsEnabled) {
          Notifications.scheduleNotificationAsync({
            content: {
              title: '🚨 Mișcare detectată!',
              body: 'A fost detectată prezență în casă!',
            },
            trigger: null,
          });
        }
      }
    });
  }, [notificationsEnabled]);

  const toggleDarkMode = async (val: boolean) => {
    setIsDarkMode(val);
    await AsyncStorage.setItem('darkMode', val.toString());
  };

  const toggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem('notificationsEnabled', val.toString());
  };

  const toggle = async (path: string, value: string, key: string) => {
    await set(ref(db, path), value);
    await AsyncStorage.setItem(key, value);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>🏠 Smart Home Dashboard</Text>

      {/* LED */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>💡 LED</Text>
        <Switch
          value={ledStatus === 'ON'}
          onValueChange={v => toggle('led/status/state', v ? 'ON' : 'OFF', 'ledStatus')}
          trackColor={{ false: '#aaa', true: theme.led }}
          thumbColor={theme.switchThumb}
        />
        <Text style={[styles.status, { color: theme.text }]}>Status: {ledStatus}</Text>
      </View>

      {/* Barieră */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🚧 Barieră</Text>
        <Switch
          value={barrierStatus === 'OPEN'}
          onValueChange={v => toggle('barrier/status/state', v ? 'OPEN' : 'CLOSE', 'barrierStatus')}
          trackColor={{ false: '#aaa', true: theme.barrier }}
          thumbColor={theme.switchThumb}
        />
        <Text style={[styles.status, { color: theme.text }]}>Status: {barrierStatus}</Text>
      </View>

      {/* Bec */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🔌 Bec</Text>
        <Switch
          value={lampStatus === 'ON'}
          onValueChange={v => toggle('lamp/status/state', v ? 'ON' : 'OFF', 'lampStatus')}
          trackColor={{ false: '#aaa', true: theme.lamp }}
          thumbColor={theme.switchThumb}
        />
        <Text style={[styles.status, { color: theme.text }]}>Status: {lampStatus}</Text>
      </View>

      {/* Temperatură & Umiditate */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🌡️ Temperatură & Umiditate</Text>
        <Text style={{ color: theme.text }}>Temperatură: {temperature ?? '...'} °C</Text>
        <Text style={{ color: theme.text }}>Umiditate: {humidity ?? '...'} %</Text>

        {temperatureHistory.length > 1 && (
          <LineChart
            data={{
              labels: temperatureHistory.map((_, i) => `${i + 1}`),
              datasets: [{ data: temperatureHistory }],
            }}
            width={Dimensions.get('window').width - 40}
            height={200}
            yAxisSuffix="°C"
            chartConfig={{
              backgroundColor: theme.card,
              backgroundGradientFrom: theme.card,
              backgroundGradientTo: theme.card,
              color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`,
              labelColor: () => theme.text,
            }}
            style={{ marginTop: 16, borderRadius: 16 }}
          />
        )}

        {humidityHistory.length > 1 && (
          <LineChart
            data={{
              labels: humidityHistory.map((_, i) => `${i + 1}`),
              datasets: [{ data: humidityHistory }],
            }}
            width={Dimensions.get('window').width - 40}
            height={200}
            yAxisSuffix="%"
            chartConfig={{
              backgroundColor: theme.card,
              backgroundGradientFrom: theme.card,
              backgroundGradientTo: theme.card,
              color: (opacity = 1) => `rgba(0, 150, 0, ${opacity})`,
              labelColor: () => theme.text,
            }}
            style={{ marginTop: 16, borderRadius: 16 }}
          />
        )}
      </View>

      {/* Mișcare */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🎯 Mișcare</Text>
        <Text style={[
          styles.motionStatus,
          {
            backgroundColor: motionStatus === 'YES' ? theme.detected : theme.notDetected,
            color: theme.text,
          },
        ]}>
          {motionStatus === 'YES' ? 'Mișcare detectată' : 'Fără mișcare'}
        </Text>
        <Text style={{ marginTop: 10, color: theme.text }}>🔔 Notificări activate:</Text>
        <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
      </View>

      {/* Dark Mode */}
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.cardTitle, { color: theme.cardTitle }]}>🌓 Dark Mode</Text>
        <Switch value={isDarkMode} onValueChange={toggleDarkMode} />
      </View>
    </ScrollView>
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
});