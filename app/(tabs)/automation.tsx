import DateTimePicker from '@react-native-community/datetimepicker';
import { onValue, push, ref, remove, update } from 'firebase/database';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../../lib/firebaseConfig';
import { useTheme } from '../../lib/ThemeContext';

interface RecurringSchedule {
  id: string;
  action: string;
  device: string;
  state: string;
  hour: number;
  minute: number;
  days: string[];
  createdAt: number;
  enabled: boolean;
  lastExecuted?: number;
  creator: string;
}

const daysOfWeek = [
  { key: 'Monday', label: 'Luni', short: 'L' },
  { key: 'Tuesday', label: 'Marți', short: 'Ma' },
  { key: 'Wednesday', label: 'Miercuri', short: 'Mi' },
  { key: 'Thursday', label: 'Joi', short: 'J' },
  { key: 'Friday', label: 'Vineri', short: 'V' },
  { key: 'Saturday', label: 'Sâmbătă', short: 'S' },
  { key: 'Sunday', label: 'Duminică', short: 'D' },
];

const actionOptions = [
  { key: 'lamp_on', label: '💡 Bec ON', device: 'lamp', state: 'ON', icon: '💡' },
  { key: 'lamp_off', label: '💡 Bec OFF', device: 'lamp', state: 'OFF', icon: '💡' },
  { key: 'led_on', label: '🔆 LED ON', device: 'led', state: 'ON', icon: '🔆' },
  { key: 'led_off', label: '🔆 LED OFF', device: 'led', state: 'OFF', icon: '🔆' },
  { key: 'priza_on', label: '🔌 Priză ON', device: 'priza', state: 'ON', icon: '🔌' },
  { key: 'priza_off', label: '🔌 Priză OFF', device: 'priza', state: 'OFF', icon: '🔌' },
  { key: 'barrier_open', label: '🚧 Barieră OPEN', device: 'barrier', state: 'OPEN', icon: '🚧' },
  { key: 'barrier_close', label: '🚧 Barieră CLOSE', device: 'barrier', state: 'CLOSE', icon: '🚧' },
];

export default function ScheduledAutomationScreen() {
  const { theme } = useTheme();
  
 
  const [time, setTime] = useState(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0); // Setează ora la 12:00 ca default
    return now;
  });
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [action, setAction] = useState<string>('lamp_on');
  const [isLoading, setIsLoading] = useState(false);
  
  // View states
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  // Încarcă automatizările recurente 
  useEffect(() => {
    const schedulesRef = ref(db, '/schedules');
    
    const unsubscribe = onValue(schedulesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Filtrează DOAR automatizările recurente (care au repeat: true)
        const recurringSchedules = Object.entries(data)
          .filter(([_, schedule]: [string, any]) => schedule.repeat === true)
          .map(([id, schedule]: [string, any]) => ({
            id,
            ...schedule,
          }));
        setSchedules(recurringSchedules.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setSchedules([]);
      }
      setLoadingSchedules(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // VALIDARE 
  const validateRecurringSchedule = (): string | null => {
    if (selectedDays.length === 0) {
      return 'Selectează cel puțin o zi pentru automatizarea recurentă!';
    }

    // Verifică dacă ora pentru ziua curentă este în viitor
    const now = new Date();
    const currentDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    
    if (selectedDays.includes(currentDayName)) {
      const todayWithSelectedTime = new Date();
      todayWithSelectedTime.setHours(time.getHours(), time.getMinutes(), 0, 0);
      
      if (todayWithSelectedTime.getTime() <= now.getTime()) {
        return 'Pentru ziua de astăzi, ora trebuie să fie în viitor!';
      }
    }

    return null;
  };

  const resetForm = () => {
    setSelectedDays([]);
    const newTime = new Date();
    newTime.setHours(12, 0, 0, 0); // Resetează la 12:00
    setTime(newTime);
    setAction('lamp_on');
  };

  // SALVARE 
  const saveRecurringSchedule = async () => {
    const validationError = validateRecurringSchedule();
    if (validationError) {
      Alert.alert('Eroare de validare', validationError);
      return;
    }

    setIsLoading(true);
    try {
      const hour = time.getHours();
      const minute = time.getMinutes();
      const selectedAction = actionOptions.find(opt => opt.key === action);
      
      const scheduleData = {
        action,
        device: selectedAction?.device,
        state: selectedAction?.state,
        hour,
        minute,
        repeat: true, // MEREU true pentru automatizări recurente
        days: selectedDays,
        createdAt: Date.now(),
        enabled: true,
        creator: 'cristinagy2002',
        type: 'recurring' // Marker pentru tip
      };

      await push(ref(db, '/schedules'), scheduleData);
      
      Alert.alert(
        ' Automatizare recurentă salvată!', 
        `Se va executa ${selectedAction?.label} la ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} în zilele selectate.`,
        [
          {
            text: 'Vezi lista',
            onPress: () => setActiveTab('list')
          },
          {
            text: 'Creează alta',
            onPress: resetForm
          }
        ]
      );
      
    } catch (error) {
      console.error('Error saving recurring schedule:', error);
      Alert.alert(' Eroare', 'Nu s-a putut salva automatizarea recurentă. Încearcă din nou!');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    Alert.alert(
      'Șterge automatizarea recurentă',
      'Ești sigur că vrei să ștergi această automatizare recurentă? Se va opri din a se mai executa în zilele programate.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove(ref(db, `/schedules/${scheduleId}`));
              Alert.alert(' Șters', 'Automatizarea recurentă a fost ștearsă cu succes!');
            } catch (error) {
              console.error('Error deleting recurring schedule:', error);
              Alert.alert(' Eroare', 'Nu s-a putut șterge automatizarea.');
            }
          },
        },
      ]
    );
  };

  const toggleScheduleEnabled = async (scheduleId: string, currentEnabled: boolean) => {
    try {
      await update(ref(db, `/schedules/${scheduleId}`), { enabled: !currentEnabled });
    } catch (error) {
      console.error('Error toggling schedule:', error);
      Alert.alert(' Eroare', 'Nu s-a putut actualiza automatizarea.');
    }
  };

  const formatScheduleTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };


  const getRecurringScheduleDescription = (schedule: RecurringSchedule) => {
    const actionOption = actionOptions.find(opt => opt.key === schedule.action);
    const timeStr = formatScheduleTime(schedule.hour, schedule.minute);
    
    const daysStr = schedule.days.length === 7 
      ? 'în fiecare zi' 
      : schedule.days.map(day => daysOfWeek.find(d => d.key === day)?.short).join(', ');
    
    return `${actionOption?.icon} ${actionOption?.label} la ${timeStr}, ${daysStr}`;
  };

  const renderScheduleItem = ({ item }: { item: RecurringSchedule }) => (
    <View style={[styles.scheduleItem, { backgroundColor: theme.card, borderColor: theme.text }]}>
      <View style={styles.scheduleHeader}>
        <View style={styles.scheduleInfo}>
          <Text style={[styles.scheduleDescription, { color: theme.text }]}>
             {getRecurringScheduleDescription(item)}
          </Text>
          <Text style={[styles.scheduleDate, { color: theme.text }]}>
            Creat: {new Date(item.createdAt).toLocaleDateString('ro-RO')}
          </Text>
          
        </View>
        
        <View style={styles.scheduleActions}>
          <Switch
            value={item.enabled}
            onValueChange={() => toggleScheduleEnabled(item.id, item.enabled)}
            trackColor={{ false: '#aaa', true: theme.card }}
            thumbColor={item.enabled ? '#4CAF50' : '#757575'}
          />
          <TouchableOpacity
            style={[styles.deleteButton, { 
              backgroundColor: '#ff4444',
              borderColor: '#ff4444'
            }]}
            onPress={() => deleteSchedule(item.id)}
          >
            <Text style={[styles.deleteButtonText, { color: 'white' }]}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={[styles.statusBadge, { 
        backgroundColor: item.enabled ? '#4CAF50' : '#757575' 
      }]}>
        <Text style={styles.statusText}>
          {item.enabled ? ' Activ săptămânal' : '⏸ Dezactivat'}
        </Text>
      </View>
    </View>
  );

  const renderCreateForm = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={[styles.title, { color: theme.text }]}> Automatizare Recurentă</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>
        Creează o automatizare care se repetă săptămânal în zilele selectate
      </Text>

      {/* Selecție acțiune */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.text }]}>Alege acțiunea:</Text>
        <View style={styles.actionsGrid}>
          {actionOptions.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.actionOption,
                { 
                  borderColor: theme.text, 
                  backgroundColor: action === opt.key ? theme.card : 'transparent' 
                }
              ]}
              onPress={() => setAction(opt.key)}
            >
              <Text style={[styles.actionText, { color: theme.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selecție oră */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.text }]}>Ora execuției zilnice:</Text>
        <TouchableOpacity
          style={[styles.timeButton, { borderColor: theme.text, backgroundColor: theme.card }]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.timeText, { color: theme.text }]}>
            {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={time}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={(event, selectedTime) => {
              setShowPicker(false);
              if (selectedTime) {
                const newTime = new Date(selectedTime);
                setTime(newTime);
              }
            }}
          />
        )}
      </View>

      {/* Selecție zile */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.text }]}>
          Selectează zilele săptămânii ({selectedDays.length} alese):
        </Text>
        <Text style={[styles.helpText, { color: theme.text }]}>
          Automatizarea se va executa în aceste zile la ora specificată
        </Text>
        <View style={styles.daysContainer}>
          {daysOfWeek.map(day => (
            <TouchableOpacity
              key={day.key}
              style={[
                styles.dayBox,
                { 
                  backgroundColor: selectedDays.includes(day.key) ? theme.card : 'transparent', 
                  borderColor: selectedDays.includes(day.key) ? '#4CAF50' : theme.text,
                  borderWidth: selectedDays.includes(day.key) ? 3 : 2,
                }
              ]}
              onPress={() => toggleDay(day.key)}
            >
              {selectedDays.includes(day.key) && (
                <Text style={styles.checkMark}>✓</Text>
              )}
              <Text style={[styles.dayText, { color: theme.text }]}>{day.short}</Text>
              <Text style={[styles.dayLabel, { color: theme.text }]}>{day.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Preview recurent */}
      <View style={[styles.preview, { backgroundColor: theme.card, borderColor: theme.text }]}>
        <Text style={[styles.previewTitle, { color: theme.text }]}> Preview Automatizare Recurentă:</Text>
        <Text style={[styles.previewText, { color: theme.text }]}>
          Acțiune: {actionOptions.find(opt => opt.key === action)?.label}
        </Text>
        <Text style={[styles.previewText, { color: theme.text }]}>
          Oră zilnică: {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')}
        </Text>
        <Text style={[styles.previewText, { color: theme.text }]}>
          Se repetă săptămânal în: {selectedDays.length > 0 ? selectedDays.map(day => daysOfWeek.find(d => d.key === day)?.label).join(', ') : 'Nicio zi selectată'}
        </Text>
        {selectedDays.length > 0 && (
          <Text style={[styles.previewNote, { color: '#4CAF50' }]}>
             Automatizarea va funcționa continuu în aceste zile
          </Text>
        )}
      </View>

      {/* Quick selectors pentru zile */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.text }]}>Selecție rapidă:</Text>
        <View style={styles.quickSelectContainer}>
          <TouchableOpacity
            style={[styles.quickSelectButton, { borderColor: theme.text, backgroundColor: theme.card }]}
            onPress={() => setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
          >
            <Text style={[styles.quickSelectText, { color: theme.text }]}> Luni-Vineri</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickSelectButton, { borderColor: theme.text, backgroundColor: theme.card }]}
            onPress={() => setSelectedDays(['Saturday', 'Sunday'])}
          >
            <Text style={[styles.quickSelectText, { color: theme.text }]}> Weekend</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickSelectButton, { borderColor: theme.text, backgroundColor: theme.card }]}
            onPress={() => setSelectedDays(daysOfWeek.map(d => d.key))}
          >
            <Text style={[styles.quickSelectText, { color: theme.text }]}> Zilnic</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.quickSelectButton, { borderColor: theme.text, backgroundColor: theme.card }]}
            onPress={() => setSelectedDays([])}
          >
            <Text style={[styles.quickSelectText, { color: theme.text }]}> Șterge</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Buton salvare */}
      <TouchableOpacity
        style={[
          styles.saveButton, 
          { backgroundColor: selectedDays.length > 0 ? '#4CAF50' : '#757575', borderColor: theme.text },
          (isLoading || selectedDays.length === 0) && styles.disabledButton
        ]}
        onPress={saveRecurringSchedule}
        disabled={isLoading || selectedDays.length === 0}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={[styles.saveButtonText, { color: 'white' }]}>
             Salvează Automatizarea Recurentă
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderSchedulesList = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.title, { color: theme.text }]}> Automatizări Recurente</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>
        Automatizări care se repetă săptămânal
      </Text>
      
      {loadingSchedules ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.text} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Se încarcă automatizările...</Text>
        </View>
      ) : schedules.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text }]}>
             Nu ai încă automatizări recurente create.
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.text }]}>
            Automatizările recurente se repetă săptămânal în zilele selectate de tine.
          </Text>
          <TouchableOpacity
            style={[styles.createFirstButton, { backgroundColor: theme.card, borderColor: theme.text }]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.createFirstButtonText, { color: theme.text }]}>
               Creează prima automatizare recurentă
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={schedules}
          renderItem={renderScheduleItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.schedulesList}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[
            styles.tab,
            { borderColor: theme.text },
            activeTab === 'create' && { backgroundColor: theme.card }
          ]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, { color: theme.text }]}> Creează Recurentă</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { borderColor: theme.text },
            activeTab === 'list' && { backgroundColor: theme.card }
          ]}
          onPress={() => setActiveTab('list')}
        >
          <Text style={[styles.tabText, { color: theme.text }]}>
             Recurente ({schedules.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'create' ? renderCreateForm() : renderSchedulesList()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 70,
  },
  tabNavigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionOption: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeButton: {
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  dayBox: {
    padding: 12,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
    position: 'relative',
  },
  checkMark: {
    position: 'absolute',
    top: 2,
    right: 4,
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dayText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  quickSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickSelectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: '22%',
    alignItems: 'center',
  },
  quickSelectText: {
    fontSize: 12,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 40,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  preview: {
    marginTop: 20,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    marginBottom: 4,
  },
  previewNote: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  
  // Schedule List Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.7,
  },
  createFirstButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderRadius: 12,
  },
  createFirstButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  schedulesList: {
    paddingBottom: 20,
  },
  scheduleItem: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  scheduleInfo: {
    flex: 1,
    marginRight: 12,
  },
  scheduleDescription: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 2,
  },
  scheduleActions: {
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});