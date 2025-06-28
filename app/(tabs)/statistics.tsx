import DateTimePicker from '@react-native-community/datetimepicker';
import { onValue, ref } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import { Dimensions, Text as RNText, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { db } from '../../lib/firebaseConfig';
import { useTheme } from '../../lib/ThemeContext';

type HistoryEntry = { time: number, value: number };

export default function StatisticsScreen() {
  const { theme } = useTheme();
  
  const [temperatureHistory, setTemperatureHistory] = useState<HistoryEntry[]>([]);
  const [humidityHistory, setHumidityHistory] = useState<HistoryEntry[]>([]);
  const [lampHistory, setLampHistory] = useState<HistoryEntry[]>([]);
  const [ledHistory, setLedHistory] = useState<HistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const filterDataByDate = (data: HistoryEntry[], targetDate: Date) => {
    const targetTimestamp = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
    const nextDayTimestamp = targetTimestamp + 24 * 60 * 60 * 1000;
    
    return data.filter(entry => 
      entry.time >= targetTimestamp && entry.time < nextDayTimestamp
    );
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  useEffect(() => {
    setTemperatureHistory([]);
    setHumidityHistory([]);
    setLampHistory([]);
    setLedHistory([]);

    const unsubscribeTempHistory = onValue(ref(db, 'history/temperature'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const allEntries = Object.entries(data)
          .map(([k, v]) => ({ time: Number(k), value: parseFloat(v as string) }))
          .sort((a, b) => a.time - b.time);
        
        const filteredEntries = filterDataByDate(allEntries, selectedDate);
        setTemperatureHistory(filteredEntries);
      } else {
        setTemperatureHistory([]);
      }
    });

    const unsubscribeHumidityHistory = onValue(ref(db, 'history/humidity'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const allEntries = Object.entries(data)
          .map(([k, v]) => ({ time: Number(k), value: parseFloat(v as string) }))
          .sort((a, b) => a.time - b.time);
        
        const filteredEntries = filterDataByDate(allEntries, selectedDate);
        setHumidityHistory(filteredEntries);
      } else {
        setHumidityHistory([]);
      }
    });

    const unsubscribeLampHistory = onValue(ref(db, 'history/lamp'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const allEntries = Object.entries(data)
          .map(([k, v]) => ({ time: Number(k), value: parseFloat(v as string) }))
          .sort((a, b) => a.time - b.time);
        
        const filteredEntries = filterDataByDate(allEntries, selectedDate);
        setLampHistory(filteredEntries);
      } else {
        setLampHistory([]);
      }
    });

    const unsubscribeLedHistory = onValue(ref(db, 'history/led'), snapshot => {
      const data = snapshot.val();
      if (data) {
        const allEntries = Object.entries(data)
          .map(([k, v]) => ({ time: Number(k), value: parseFloat(v as string) }))
          .sort((a, b) => a.time - b.time);
        
        const filteredEntries = filterDataByDate(allEntries, selectedDate);
        setLedHistory(filteredEntries);
      } else {
        setLedHistory([]);
      }
    });

    return () => {
      unsubscribeTempHistory();
      unsubscribeHumidityHistory();
      unsubscribeLampHistory();
      unsubscribeLedHistory();
    };
  }, [selectedDate]);

  const chartConfig = {
    backgroundColor: theme.card,
    backgroundGradientFrom: theme.card,
    backgroundGradientTo: theme.card,
    color: (opacity = 1) => theme.activeDot,
    labelColor: () => theme.text,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForLabels: {
      fontSize: 10,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
    },
  };

  // Funcție pentru conversie ore în minute
  const hoursToMinutes = (hours: number) => Math.round(hours * 60);

  // Funcție pentru filtrarea datelor pentru a afișa doar puncte orare
  const filterToHourlyPoints = (data: HistoryEntry[]) => {
    const hourlyPoints: HistoryEntry[] = [];
    const hourMap = new Map<number, HistoryEntry[]>();
    
    // Grupează pe ore
    data.forEach(entry => {
      const date = new Date(entry.time);
      const hourKey = date.getHours();
      
      if (!hourMap.has(hourKey)) {
        hourMap.set(hourKey, []);
      }
      hourMap.get(hourKey)!.push(entry);
    });
    
    // Ia prima intrare din fiecare oră (sau poți lua media)
    Array.from(hourMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([hour, entries]) => {
        // Ia intrarea cea mai apropiată de începutul orei
        const hourStart = new Date(entries[0].time);
        hourStart.setHours(hour, 0, 0, 0);
        
        const closestEntry = entries.reduce((closest, current) => {
          const closestDiff = Math.abs(closest.time - hourStart.getTime());
          const currentDiff = Math.abs(current.time - hourStart.getTime());
          return currentDiff < closestDiff ? current : closest;
        });
        
        hourlyPoints.push(closestEntry);
      });
    
    return hourlyPoints;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.contentContainer}>
      <RNText style={[styles.title, { color: theme.cardTitle }]}>📊 Statistici</RNText>

      {/* Selector data */}
      <View style={[styles.dateSelector, { backgroundColor: theme.card }]}>
        <RNText style={[styles.dateSelectorTitle, { color: theme.cardTitle }]}>Selectează data:</RNText>
        <TouchableOpacity
          style={[styles.datePickerButton, { backgroundColor: theme.activeDot }]}
          onPress={() => setShowDatePicker(true)}
        >
          <RNText style={[styles.datePickerButtonText, { color: 'white' }]}>
             {selectedDate.toLocaleDateString('ro-RO', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </RNText>
        </TouchableOpacity>
        
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={new Date()}
          />
        )}
      </View>

      {/* Grafic Temperatură  */}
      {temperatureHistory.length > 0 && (
        <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
          <RNText style={[styles.chartTitle, { color: theme.cardTitle }]}>
             Istoric Temperatură - {selectedDate.toLocaleDateString('ro-RO')} (pe ore)
          </RNText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(() => {
              const hourlyTemp = filterToHourlyPoints(temperatureHistory);
              return (
                <LineChart
                  data={{
                    labels: hourlyTemp.map(entry => {
                      const date = new Date(entry.time);
                      return `${date.getHours().toString().padStart(2, '0')}:00`;
                    }),
                    datasets: [{
                      data: hourlyTemp.map(e => e.value),
                      strokeWidth: 2,
                    }],
                  }}
                  width={Math.max(Dimensions.get('window').width - 20, hourlyTemp.length * 60)}
                  height={300}
                  yAxisSuffix="°C"
                  chartConfig={chartConfig}
                  style={styles.chart}
                  withDots={true}
                  withInnerLines={false}
                  withOuterLines={true}
                  bezier
                  decorator={() => {
                    const chartWidth = Math.max(Dimensions.get('window').width - 100, hourlyTemp.length * 60 - 80);
                    const leftPadding = 60;
                    const topPadding = 50;
                    const chartHeight = 200;
                    
                    const minValue = Math.min(...hourlyTemp.map(e => e.value));
                    const maxValue = Math.max(...hourlyTemp.map(e => e.value));
                    const valueRange = maxValue - minValue || 1;
                    
                    return hourlyTemp.map((entry, index) => {
                      const x = leftPadding + (index / Math.max(1, hourlyTemp.length - 1)) * chartWidth;
                      const normalizedValue = (entry.value - minValue) / valueRange;
                      const y = topPadding + (1 - normalizedValue) * chartHeight - 15;
                      
                      return (
                        <View key={index} style={{
                          position: 'absolute',
                          left: x - 15,
                          top: y,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}>
                          <RNText style={{
                            color: 'white',
                            fontSize: 9,
                            fontWeight: '600',
                            textAlign: 'center',
                          }}>
                            {entry.value.toFixed(1)}°
                          </RNText>
                        </View>
                      );
                    });
                  }}
                />
              );
            })()}
          </ScrollView>
          <RNText style={[styles.chartSubtitle, { color: theme.text }]}>
            Temperatură măsurată la fiecare oră exactă
          </RNText>
        </View>
      )}

      {/* Grafic Umiditate */} 
      {humidityHistory.length > 0 && (
        <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
          <RNText style={[styles.chartTitle, { color: theme.cardTitle }]}>
             Istoric Umiditate - {selectedDate.toLocaleDateString('ro-RO')} (pe ore)
          </RNText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(() => {
              const hourlyHumidity = filterToHourlyPoints(humidityHistory);
              return (
                <LineChart
                  data={{
                    labels: hourlyHumidity.map(entry => {
                      const date = new Date(entry.time);
                      return `${date.getHours().toString().padStart(2, '0')}:00`;
                    }),
                    datasets: [{
                      data: hourlyHumidity.map(e => e.value),
                      strokeWidth: 2,
                    }],
                  }}
                  width={Math.max(Dimensions.get('window').width - 20, hourlyHumidity.length * 60)}
                  height={300}
                  yAxisSuffix="%"
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => theme.barrier,
                  }}
                  style={styles.chart}
                  withDots={true}
                  withInnerLines={false}
                  withOuterLines={true}
                  bezier
                  decorator={() => {
                    const chartWidth = Math.max(Dimensions.get('window').width - 100, hourlyHumidity.length * 60 - 80);
                    const leftPadding = 60;
                    const topPadding = 50;
                    const chartHeight = 200;
                    
                    const minValue = Math.min(...hourlyHumidity.map(e => e.value));
                    const maxValue = Math.max(...hourlyHumidity.map(e => e.value));
                    const valueRange = maxValue - minValue || 1;
                    
                    return hourlyHumidity.map((entry, index) => {
                      const x = leftPadding + (index / Math.max(1, hourlyHumidity.length - 1)) * chartWidth;
                      const normalizedValue = (entry.value - minValue) / valueRange;
                      const y = topPadding + (1 - normalizedValue) * chartHeight - 15;
                      
                      return (
                        <View key={index} style={{
                          position: 'absolute',
                          left: x - 12,
                          top: y,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}>
                          <RNText style={{
                            color: 'white',
                            fontSize: 9,
                            fontWeight: '600',
                            textAlign: 'center',
                          }}>
                            {entry.value.toFixed(0)}%
                          </RNText>
                        </View>
                      );
                    });
                  }}
                />
              );
            })()}
          </ScrollView>
          <RNText style={[styles.chartSubtitle, { color: theme.text }]}>
            Umiditate măsurată la fiecare oră exactă
          </RNText>
        </View>
      )}

      {/* Grafic Bec  */}
      {lampHistory.length > 0 && (
        <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
          <RNText style={[styles.chartTitle, { color: theme.cardTitle }]}>
             Istoric Bec - {selectedDate.toLocaleDateString('ro-RO')} ({lampHistory.length} sesiuni)
          </RNText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: lampHistory.map((e, idx) => {
                  // Afișează eticheta doar pentru a 2-a sau a 3-a sesiune
                  const shouldShowLabel = idx === 0 || 
                                      idx === lampHistory.length - 1 ||
                                      idx % Math.max(2, Math.floor(lampHistory.length / 6)) === 0;
                  
                  if (shouldShowLabel) {
                    const date = new Date(e.time);
                    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                  }
                  return '';
                }),
                datasets: [{
                  data: lampHistory.map(e => hoursToMinutes(e.value)),
                  strokeWidth: 2,
                }],
              }}
              width={Math.max(Dimensions.get('window').width - 20, lampHistory.length * 70)}
              height={300}
              yAxisSuffix="min"
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => theme.lamp,
              }}
              style={styles.chart}
              withDots={true}
              withInnerLines={false}
              withOuterLines={true}
              bezier
              decorator={() => {
                const chartWidth = Math.max(Dimensions.get('window').width - 100, lampHistory.length * 70 - 80);
                const leftPadding = 60;
                const topPadding = 50;
                const chartHeight = 200;
                
                const minuteValues = lampHistory.map(e => hoursToMinutes(e.value));
                const minValue = Math.min(...minuteValues);
                const maxValue = Math.max(...minuteValues);
                const valueRange = maxValue - minValue || 1;
                
                // Afișează etichete doar pentru câteva puncte importante
                return lampHistory.map((entry, index) => {
                  const shouldShowLabel = index === 0 || 
                                        index === lampHistory.length - 1 ||
                                        index % Math.max(2, Math.floor(lampHistory.length / 6)) === 0;
                  
                  if (!shouldShowLabel) return null;
                  
                  const minuteValue = hoursToMinutes(entry.value);
                  const x = leftPadding + (index / Math.max(1, lampHistory.length - 1)) * chartWidth;
                  const normalizedValue = (minuteValue - minValue) / valueRange;
                  const y = topPadding + (1 - normalizedValue) * chartHeight - 15;
                  
                  return (
                    <View key={index} style={{
                      position: 'absolute',
                      left: x - 15,
                      top: y,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                    }}>
                      <RNText style={{
                        color: 'white',
                        fontSize: 9,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {minuteValue}min
                      </RNText>
                    </View>
                  );
                }).filter(Boolean);
              }}
            />
          </ScrollView>
          <RNText style={[styles.chartSubtitle, { color: theme.text }]}>
            Durata sesiunilor bec cu puncte la intervale regulate
          </RNText>
        </View>
      )}

      {/* Grafic LED  */}
      {ledHistory.length > 0 && (
        <View style={[styles.chartContainer, { backgroundColor: theme.card }]}>
          <RNText style={[styles.chartTitle, { color: theme.cardTitle }]}>
             Istoric LED - {selectedDate.toLocaleDateString('ro-RO')} ({ledHistory.length} sesiuni)
          </RNText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={{
                labels: ledHistory.map((e, idx) => {
                  // Afișează eticheta doar pentru a 2-a sau a 3-a sesiune
                  const shouldShowLabel = idx === 0 || 
                                      idx === ledHistory.length - 1 ||
                                      idx % Math.max(2, Math.floor(ledHistory.length / 6)) === 0;
                  
                  if (shouldShowLabel) {
                    const date = new Date(e.time);
                    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                  }
                  return '';
                }),
                datasets: [{
                  data: ledHistory.map(e => hoursToMinutes(e.value)),
                  strokeWidth: 2,
                }],
              }}
              width={Math.max(Dimensions.get('window').width - 20, ledHistory.length * 70)}
              height={300}
              yAxisSuffix="min"
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => theme.led,
              }}
              style={styles.chart}
              withDots={true}
              withInnerLines={false}
              withOuterLines={true}
              bezier
              decorator={() => {
                const chartWidth = Math.max(Dimensions.get('window').width - 100, ledHistory.length * 70 - 80);
                const leftPadding = 60;
                const topPadding = 50;
                const chartHeight = 200;
                
                const minuteValues = ledHistory.map(e => hoursToMinutes(e.value));
                const minValue = Math.min(...minuteValues);
                const maxValue = Math.max(...minuteValues);
                const valueRange = maxValue - minValue || 1;
                
                // Afișează etichete doar pentru câteva puncte importante
                return ledHistory.map((entry, index) => {
                  const shouldShowLabel = index === 0 || 
                                        index === ledHistory.length - 1 ||
                                        index % Math.max(2, Math.floor(ledHistory.length / 6)) === 0;
                  
                  if (!shouldShowLabel) return null;
                  
                  const minuteValue = hoursToMinutes(entry.value);
                  const x = leftPadding + (index / Math.max(1, ledHistory.length - 1)) * chartWidth;
                  const normalizedValue = (minuteValue - minValue) / valueRange;
                  const y = topPadding + (1 - normalizedValue) * chartHeight - 15;
                  
                  return (
                    <View key={index} style={{
                      position: 'absolute',
                      left: x - 15,
                      top: y,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 8,
                    }}>
                      <RNText style={{
                        color: 'white',
                        fontSize: 9,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}>
                        {minuteValue}min
                      </RNText>
                    </View>
                  );
                }).filter(Boolean);
              }}
            />
          </ScrollView>
          <RNText style={[styles.chartSubtitle, { color: theme.text }]}>
            Durata sesiunilor LED cu puncte la intervale regulate
          </RNText>
        </View>
      )}

      {/* Rezumat Statistici */}
      <View style={[styles.statsContainer, { backgroundColor: theme.card }]}>
        <RNText style={[styles.chartTitle, { color: theme.cardTitle }]}>
           Rezumat - {selectedDate.toLocaleDateString('ro-RO')}
        </RNText>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Temperatură medie:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.activeDot }]}>
            {temperatureHistory.length > 0
              ? (temperatureHistory.reduce((sum, entry) => sum + entry.value, 0) / temperatureHistory.length).toFixed(1)
              : '0'
            }°C
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Umiditate medie:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.barrier }]}>
            {humidityHistory.length > 0
              ? (humidityHistory.reduce((sum, entry) => sum + entry.value, 0) / humidityHistory.length).toFixed(1)
              : '0'
            }%
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Număr sesiuni bec:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.lamp }]}>
            {lampHistory.length}
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Număr sesiuni LED:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.led }]}>
            {ledHistory.length}
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Sesiune medie bec:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.lamp }]}>
            {lampHistory.length > 0
              ? Math.round(lampHistory.reduce((sum, entry) => sum + entry.value, 0) / lampHistory.length * 60)
              : '0'
            } min
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Sesiune medie LED:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.led }]}>
            {ledHistory.length > 0
              ? Math.round(ledHistory.reduce((sum, entry) => sum + entry.value, 0) / ledHistory.length * 60)
              : '0'
            } min
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Cea mai lungă sesiune bec:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.lamp }]}>
            {lampHistory.length > 0
              ? Math.round(Math.max(...lampHistory.map(e => e.value)) * 60)
              : '0'
            } min
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Cea mai lungă sesiune LED:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.led }]}>
            {ledHistory.length > 0
              ? Math.round(Math.max(...ledHistory.map(e => e.value)) * 60)
              : '0'
            } min
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Total timp bec aprins:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.lamp }]}>
            {lampHistory.length > 0
              ? Math.round(lampHistory.reduce((sum, entry) => sum + entry.value, 0) * 60)
              : '0'
            } min
          </RNText>
        </View>
        <View style={styles.statRow}>
          <RNText style={[styles.statLabel, { color: theme.text }]}>
            Total timp LED aprins:
          </RNText>
          <RNText style={[styles.statValue, { color: theme.led }]}>
            {ledHistory.length > 0
              ? Math.round(ledHistory.reduce((sum, entry) => sum + entry.value, 0) * 60)
              : '0'
            } min
          </RNText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateSelector: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSelectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  chartContainer: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  chart: {
    borderRadius: 16,
  },
  statsContainer: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});