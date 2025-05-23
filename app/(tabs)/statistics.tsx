import DateTimePicker from '@react-native-community/datetimepicker';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db } from '../../lib/firebaseConfig';

export default function StatisticsScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [temperatureData, setTemperatureData] = useState<{ [minute: string]: number }>({});
  const [humidityData, setHumidityData] = useState<{ [minute: string]: number }>({});

  useEffect(() => {
    const tempRef = ref(db, 'history/temperature');
    const humRef = ref(db, 'history/humidity');

    onValue(tempRef, snapshot => {
      const raw = snapshot.val();
      if (!raw) return;

      const tempPerMinute: { [minute: string]: number[] } = {};

      for (const [timestamp, value] of Object.entries(raw)) {
        const date = new Date(Number(timestamp));
        if (
          date.getFullYear() === selectedDate.getFullYear() &&
          date.getMonth() === selectedDate.getMonth() &&
          date.getDate() === selectedDate.getDate()
        ) {
          const label = `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;

          if (!tempPerMinute[label]) tempPerMinute[label] = [];
          tempPerMinute[label].push(Number(value));
        }
      }

      const averaged: { [minute: string]: number } = {};
      for (const [minute, values] of Object.entries(tempPerMinute)) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        averaged[minute] = parseFloat(avg.toFixed(1));
      }

      setTemperatureData(averaged);
    });

    onValue(humRef, snapshot => {
      const raw = snapshot.val();
      if (!raw) return;

      const humPerMinute: { [minute: string]: number[] } = {};

      for (const [timestamp, value] of Object.entries(raw)) {
        const date = new Date(Number(timestamp));
        if (
          date.getFullYear() === selectedDate.getFullYear() &&
          date.getMonth() === selectedDate.getMonth() &&
          date.getDate() === selectedDate.getDate()
        ) {
          const label = `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;

          if (!humPerMinute[label]) humPerMinute[label] = [];
          humPerMinute[label].push(Number(value));
        }
      }

      const averaged: { [minute: string]: number } = {};
      for (const [minute, values] of Object.entries(humPerMinute)) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        averaged[minute] = parseFloat(avg.toFixed(1));
      }

      setHumidityData(averaged);
    });
  }, [selectedDate]);

  const labels = Object.keys(temperatureData).sort();
  const tempValues = labels.map((m) => temperatureData[m] ?? 0);
  const humValues = labels.map((m) => humidityData[m] ?? 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>📊 Statistici zilnice</Text>
      <Text style={styles.label} onPress={() => setShowPicker(true)}>
        Zi selectată: {selectedDate.toLocaleDateString()}
      </Text>
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, date) => {
            setShowPicker(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {labels.length > 0 ? (
        <>
          <Text style={styles.subtitle}>Temperatură (°C)</Text>
          <LineChart
            data={{
              labels,
              datasets: [{ data: tempValues }],
            }}
            width={Dimensions.get('window').width - 40}
            height={220}
            yAxisSuffix="°C"
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0,0,255,${opacity})`,
              labelColor: () => '#333',
            }}
            style={{ marginVertical: 16, borderRadius: 16 }}
          />

          <Text style={styles.subtitle}>Umiditate (%)</Text>
          <LineChart
            data={{
              labels,
              datasets: [{ data: humValues }],
            }}
            width={Dimensions.get('window').width - 40}
            height={220}
            yAxisSuffix="%"
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(0,150,0,${opacity})`,
              labelColor: () => '#333',
            }}
            style={{ marginBottom: 32, borderRadius: 16 }}
          />
        </>
      ) : (
        <Text style={{ marginTop: 40, fontSize: 16, color: '#555' }}>
          Nu există date pentru ziua selectată.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: '#007AFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 4,
  },
});