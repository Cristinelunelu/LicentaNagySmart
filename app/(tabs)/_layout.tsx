import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTheme } from '../../lib/ThemeContext';

export default function Layout() {
  const { theme, isDarkMode } = useTheme();

  return (
    <Tabs
      key={isDarkMode ? 'dark' : 'light'}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Acasă',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={focused ? 26 : 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistici',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "analytics" : "analytics-outline"} 
              size={focused ? 26 : 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="weather"
        options={{
          title: 'Meteo',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "partly-sunny" : "partly-sunny-outline"} 
              size={focused ? 26 : 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="automation"
        options={{
          title: 'Automatizări',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "flash" : "flash-outline"} 
              size={focused ? 26 : 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="location"
        options={{
          title: 'Locație',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons 
              name={focused ? "location" : "location-outline"} 
              size={focused ? 26 : 24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
