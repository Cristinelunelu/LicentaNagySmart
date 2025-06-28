import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

// Tipuri pentru API
interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
    pressure: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
    deg: number;
  };
  name: string;
  dt: number;
}

interface ForecastData {
  list: Array<{
    dt: number;
    main: {
      temp: number;
      temp_min: number;
      temp_max: number;
      humidity: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    wind: {
      speed: number;
    };
    dt_txt: string;
  }>;
  city: {
    name: string;
    country: string;
  };
}

interface HourlyForecast {
  time: string;
  hour: string;
  temp: number;
  description: string;
  icon: string;
  humidity: number;
  wind: number;
  feels_like: number;
}

interface DailyForecast {
  date: string;
  dayName: string;
  temp_min: number;
  temp_max: number;
  mainDescription: string;
  mainIcon: string;
  hourlyData: HourlyForecast[];
}

export default function WeatherScreen() {
  const { theme } = useTheme();
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(null);
  const [weeklyForecast, setWeeklyForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationName, setLocationName] = useState<string>('Se detectează...');
  const [isLocationMode, setIsLocationMode] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [showCityModal, setShowCityModal] = useState(false);
  const [tempCity, setTempCity] = useState<string>('');
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // API Key pentru OpenWeatherMap
  const API_KEY = 'c6ab5394f4ce64e7c662ba231b12efb3';

  // Lista de orașe predefinite
  const popularCities = [
    'București, RO',
    'Cluj-Napoca, RO',
    'Timișoara, RO',
    'Iași, RO',
    'Constanța, RO',
    'Craiova, RO',
    'Brașov, RO',
    'Galați, RO',
    'Ploiești, RO',
    'Oradea, RO',
    'London, GB',
    'Paris, FR',
    'Berlin, DE',
    'Rome, IT',
    'Madrid, ES',
    'New York, US',
    'Tokyo, JP'
  ];

  // Funcție pentru a obține locația curentă
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permisiunea pentru locație a fost refuzată');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };

      setCurrentLocation(coords);

      // Obține numele locației folosind reverse geocoding
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync(coords);
        if (reverseGeocode.length > 0) {
          const address = reverseGeocode[0];
          const cityName = address.city || address.subregion || address.region || 'Locația curentă';
          setLocationName(cityName);
        }
      } catch (geocodeError) {
        console.log('Reverse geocoding error:', geocodeError);
        setLocationName('Locația curentă');
      }

      return coords;
    } catch (error) {
      console.error('Error getting location:', error);
      setError('Nu s-a putut obține locația. Verifică permisiunile și GPS-ul.');
      return null;
    }
  };

  const fetchWeatherData = async () => {
    try {
      setError(null);
      
      let weatherUrl = '';
      let forecastUrl = '';

      if (isLocationMode) {
        // Folosește locația curentă
        const location = await getCurrentLocation();
        if (!location) {
          return;
        }
        const { latitude, longitude } = location;
        weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ro`;
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric&lang=ro`;
      } else {
        // Folosește orașul selectat
        if (!selectedCity) {
          setError('Te rog selectează un oraș');
          return;
        }
        weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${selectedCity}&appid=${API_KEY}&units=metric&lang=ro`;
        forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${selectedCity}&appid=${API_KEY}&units=metric&lang=ro`;
        setLocationName(selectedCity.split(',')[0]); // Doar numele orașului
      }
      
      // Current weather
      const currentResponse = await fetch(weatherUrl);
      if (!currentResponse.ok) {
        throw new Error('Nu pot obține datele meteo curente');
      }
      const currentData: WeatherData = await currentResponse.json();
      setCurrentWeather(currentData);

      // Weekly forecast
      const forecastResponse = await fetch(forecastUrl);
      if (!forecastResponse.ok) {
        throw new Error('Nu pot obține prognoza meteo');
      }
      const forecastData: ForecastData = await forecastResponse.json();
      
      // Process forecast data pentru săptămână
      const weeklyForecasts = processWeeklyForecastData(forecastData);
      setWeeklyForecast(weeklyForecasts);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eroare necunoscută');
      console.error('Weather API Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processWeeklyForecastData = (data: ForecastData): DailyForecast[] => {
    const dailyMap = new Map<string, any>();
    
    // Grupează datele pe zile
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          date: date.toLocaleDateString('ro-RO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
          }),
          dayName: date.toLocaleDateString('ro-RO', { weekday: 'long' }),
          temp_min: item.main.temp_min,
          temp_max: item.main.temp_max,
          mainDescription: item.weather[0].description,
          mainIcon: item.weather[0].icon,
          hourlyData: []
        });
      }
      
      const dayData = dailyMap.get(dateKey);
      dayData.temp_min = Math.min(dayData.temp_min, item.main.temp_min);
      dayData.temp_max = Math.max(dayData.temp_max, item.main.temp_max);
      
      // Adaugă datele pe ore
      dayData.hourlyData.push({
        time: date.toLocaleDateString('ro-RO', {
          day: 'numeric',
          month: 'short'
        }),
        hour: date.toLocaleTimeString('ro-RO', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        temp: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        wind: item.wind.speed,
        feels_like: Math.round(item.main.temp)
      });
    });
    
    // Convertește la array și sortează
    const dailyForecasts = Array.from(dailyMap.values());
    
    // Limitează la 7 zile pentru săptămână
    return dailyForecasts.slice(0, 7);
  };

  const toggleDayExpansion = (dayIndex: number) => {
    setExpandedDay(expandedDay === dayIndex ? null : dayIndex);
  };

  const handleLocationModeToggle = () => {
    setIsLocationMode(!isLocationMode);
    if (!isLocationMode) {
      // Dacă se schimbă la modul locație, resetează orașul selectat
      setSelectedCity('');
    }
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setTempCity('');
    setShowCityModal(false);
    setIsLocationMode(false);
  };

  const handleCustomCitySubmit = () => {
    if (tempCity.trim()) {
      setSelectedCity(tempCity.trim());
      setShowCityModal(false);
      setIsLocationMode(false);
      setTempCity('');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchWeatherData();
  };

  useEffect(() => {
    fetchWeatherData();
  }, [isLocationMode, selectedCity]);

  const getWeatherIcon = (iconCode: string) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.activeDot} />
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {isLocationMode 
            ? 'Se detectează locația și se încarcă datele meteo...'
            : 'Se încarcă datele meteo...'
          }
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
        <Text style={[styles.errorText, { color: '#ff6b6b' }]}>
           {error}
        </Text>
        <Text style={[styles.errorSubtext, { color: theme.text }]}>
          Verifică conexiunea la internet{isLocationMode ? ', GPS-ul și permisiunile pentru locație' : ''}
        </Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: theme.activeDot }]}
          onPress={() => {
            setError(null);
            setLoading(true);
            fetchWeatherData();
          }}
        >
          <Text style={styles.retryButtonText}>Încearcă din nou</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header cu selector de locație */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.cardTitle }]}>
          🌤️ Prognoză Meteo
        </Text>
        
        {/* Location Selector */}
        <View style={styles.locationSelector}>
          <TouchableOpacity 
            style={[
              styles.locationButton, 
              { 
                backgroundColor: isLocationMode ? theme.activeDot : theme.card,
                borderColor: theme.activeDot 
              }
            ]}
            onPress={handleLocationModeToggle}
          >
            <Ionicons 
              name="location" 
              size={16} 
              color={isLocationMode ? 'white' : theme.activeDot} 
            />
            <Text style={[
              styles.locationButtonText, 
              { color: isLocationMode ? 'white' : theme.activeDot }
            ]}>
              Locația mea
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.locationButton, 
              { 
                backgroundColor: !isLocationMode ? theme.activeDot : theme.card,
                borderColor: theme.activeDot 
              }
            ]}
            onPress={() => setShowCityModal(true)}
          >
            <Ionicons 
              name="earth" 
              size={16} 
              color={!isLocationMode ? 'white' : theme.activeDot} 
            />
            <Text style={[
              styles.locationButtonText, 
              { color: !isLocationMode ? 'white' : theme.activeDot }
            ]}>
              Alte orașe
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: theme.text }]}>
          📍 {locationName}
        </Text>
      </View>

      {/* Current Weather */}
      {currentWeather && (
        <View style={[styles.currentWeatherCard, { backgroundColor: theme.card }]}>
          <View style={styles.currentWeatherHeader}>
            <View style={styles.currentTemp}>
              <Image 
                source={{ uri: getWeatherIcon(currentWeather.weather[0].icon) }}
                style={styles.currentWeatherIcon}
              />
              <Text style={[styles.currentTempText, { color: theme.cardTitle }]}>
                {Math.round(currentWeather.main.temp)}°C
              </Text>
            </View>
          </View>
          
        
          <View style={styles.weatherDetails}>
            <Text style={[styles.currentDescription, { color: theme.text }]}>
              {currentWeather.weather[0].description}
            </Text>
            <Text style={[styles.feelsLike, { color: theme.text }]}>
              Resimțită: {Math.round(currentWeather.main.feels_like)}°C
            </Text>
          </View>
          
          <View style={styles.currentStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.cardTitle }]}>
                {currentWeather.main.humidity}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>Umiditate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.cardTitle }]}>
                {Math.round(currentWeather.wind.speed * 3.6)} km/h
              </Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>Vânt</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.cardTitle }]}>
                {currentWeather.main.pressure} hPa
              </Text>
              <Text style={[styles.statLabel, { color: theme.text }]}>Presiune</Text>
            </View>
          </View>
        </View>
      )}

      {/* Weekly Forecast */}
      <View style={styles.forecastSection}>
        <Text style={[styles.sectionTitle, { color: theme.cardTitle }]}>
          📅 Prognoza pe 7 zile
        </Text>
        
        {weeklyForecast.map((day, dayIndex) => (
          <View key={dayIndex} style={[styles.dayCard, { backgroundColor: theme.card }]}>
            {/* Day Header */}
            <TouchableOpacity 
              style={styles.dayHeader}
              onPress={() => toggleDayExpansion(dayIndex)}
            >
              <View style={styles.dayInfo}>
                <Text style={[styles.dayName, { color: theme.cardTitle }]}>
                  {day.dayName}
                </Text>
                <Text style={[styles.dayDate, { color: theme.text }]}>
                  {day.date}
                </Text>
              </View>
              
              <View style={styles.dayWeather}>
                <Image 
                  source={{ uri: getWeatherIcon(day.mainIcon) }}
                  style={styles.dayIcon}
                />
                <View style={styles.dayTemps}>
                  <Text style={[styles.maxTemp, { color: theme.cardTitle }]}>
                    {Math.round(day.temp_max)}°
                  </Text>
                  <Text style={[styles.minTemp, { color: theme.text }]}>
                    {Math.round(day.temp_min)}°
                  </Text>
                </View>
              </View>
              
              <Ionicons 
                name={expandedDay === dayIndex ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.text} 
              />
            </TouchableOpacity>
            
            <Text style={[styles.dayDescription, { color: theme.text }]}>
              {day.mainDescription}
            </Text>

            {/* Prognoza pe ore */}
            {expandedDay === dayIndex && (
              <View style={styles.expandedSection}>
                <Text style={[styles.hourlyTitle, { color: theme.cardTitle }]}>
                  ⏰ Prognoza pe ore:
                </Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.hourlyContainer}
                >
                  {day.hourlyData.map((hour, hourIndex) => (
                    <View key={hourIndex} style={[styles.hourlyCard, { backgroundColor: theme.background }]}>
                      <Text style={[styles.hourlyHour, { color: theme.cardTitle }]}>
                        {hour.hour}
                      </Text>
                      <Image 
                        source={{ uri: getWeatherIcon(hour.icon) }}
                        style={styles.hourlyIcon}
                      />
                      <Text style={[styles.hourlyTemp, { color: theme.cardTitle }]}>
                        {hour.temp}°C
                      </Text>
                      <Text style={[styles.hourlyDescription, { color: theme.text }]}>
                        {hour.description}
                      </Text>
                      <View style={styles.hourlyStats}>
                        <Text style={[styles.hourlyStat, { color: theme.text }]}>
                          💧 {hour.humidity}%
                        </Text>
                        <Text style={[styles.hourlyStat, { color: theme.text }]}>
                          💨 {Math.round(hour.wind * 3.6)} km/h
                        </Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Selector oraș */}
      <Modal
        visible={showCityModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.cardTitle }]}>
                Selectează orașul
              </Text>
              <TouchableOpacity 
                onPress={() => setShowCityModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.customCitySection}>
              <TextInput
                style={[
                  styles.cityInput, 
                  { 
                    backgroundColor: theme.background, 
                    color: theme.text,
                    borderColor: theme.text + '30'
                  }
                ]}
                placeholder="Introdu un oraș (ex: București, RO)"
                placeholderTextColor={theme.text + '70'}
                value={tempCity}
                onChangeText={setTempCity}
                onSubmitEditing={handleCustomCitySubmit}
              />
              <TouchableOpacity 
                style={[styles.addCityButton, { backgroundColor: theme.activeDot }]}
                onPress={handleCustomCitySubmit}
              >
                <Text style={styles.addCityButtonText}>Adaugă</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.citiesList}>
              <Text style={[styles.citiesListTitle, { color: theme.text }]}>
                Orașe populare:
              </Text>
              {popularCities.map((city, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.cityOption,
                    { 
                      backgroundColor: selectedCity === city ? theme.activeDot + '20' : 'transparent',
                      borderBottomColor: theme.text + '20'
                    }
                  ]}
                  onPress={() => handleCitySelect(city)}
                >
                  <Text style={[styles.cityOptionText, { color: theme.text }]}>
                    {city}
                  </Text>
                  {selectedCity === city && (
                    <Ionicons name="checkmark" size={20} color={theme.activeDot} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 20,
  },
  locationSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
  },
  currentWeatherCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 30, 
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  currentWeatherHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20, 
  },
  currentTemp: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentWeatherIcon: {
    width: 100, 
    height: 100, 
  },
  currentTempText: {
    fontSize: 64, 
    fontWeight: '800',
    marginLeft: 15, 
  },
  weatherDetails: {
    alignItems: 'center',
    marginBottom: 25, 
  },
  currentDescription: {
    fontSize: 20, 
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
    marginBottom: 8, 
  },
  feelsLike: {
    fontSize: 16, 
    opacity: 0.7,
    textAlign: 'center',
  },
  currentStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 25, 
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24, 
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14, 
    opacity: 0.7,
    marginTop: 6, 
  },
  forecastSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  dayCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayDate: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  dayWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  dayIcon: {
    width: 50,
    height: 50,
  },
  dayTemps: {
    marginLeft: 8,
  },
  maxTemp: {
    fontSize: 20,
    fontWeight: '700',
  },
  minTemp: {
    fontSize: 16,
    opacity: 0.7,
  },
  dayDescription: {
    fontSize: 14,
    textTransform: 'capitalize',
    marginBottom: 8,
    opacity: 0.8,
  },
  expandedSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  hourlyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  hourlyContainer: {
    marginHorizontal: -8,
  },
  hourlyCard: {
    width: 120,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  hourlyHour: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  hourlyIcon: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },
  hourlyTemp: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  hourlyDescription: {
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: 6,
    minHeight: 24,
  },
  hourlyStats: {
    gap: 2,
  },
  hourlyStat: {
    fontSize: 9,
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  customCitySection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  addCityButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  addCityButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  citiesList: {
    maxHeight: 300,
  },
  citiesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  cityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  cityOptionText: {
    fontSize: 16,
  },
});