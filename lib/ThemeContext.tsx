import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface Theme {
  // Background colors
  background: string;
  card: string;
  cardShadow: string;
  
  // Text colors
  text: string;
  cardTitle: string;
  textSecondary: string;
  
  // Component colors
  switchThumb: string;
  darkModeTrack: string;
  
  // Device colors
  led: string;
  barrier: string;
  lamp: string;
  
  // Status colors
  detected: string;
  notDetected: string;
  gasDanger: string;
  gasOk: string;
  
  // Accent colors
  activeDot: string;
  notifActive: string;
  accent: string;

  // Door colors
  doorOpen: string;
  doorClosed: string;

  // Input colors
  inputBg: string;
  inputBorder: string;

  // Card item background
  cardItemBg: string;
}

const lightTheme: Theme = {
  // Background colors
  background: '#F8F9FA',
  card: '#FFFFFF',
  cardShadow: 'rgba(0,0,0,0.08)',
  
  // Text colors
  text: '#2C3E50',
  cardTitle: '#1A202C',
  textSecondary: '#666666',
  
  // Component colors
  switchThumb: '#FFFFFF',
  darkModeTrack: '#E5E7EB',
  
  // Device colors
  led: '#10B981',
  barrier: '#3B82F6',
  lamp: '#F59E0B',
  
  // Status colors
  detected: '#EF4444',
  notDetected: '#10B981',
  gasDanger: '#EF4444',
  gasOk: '#10B981',
  
  // Accent colors
  activeDot: '#8B5CF6',
  notifActive: '#10B981',
  accent: '#8B5CF6',

  // Door colors
  doorOpen: '#ff6b6b',
  doorClosed: '#51cf66',

  // Input colors
  inputBg: '#ffffff',
  inputBorder: '#e0e0e0',

  // Card item background
  cardItemBg: '#f8f9fa',
};

const darkTheme: Theme = {
  // Background colors
  background: '#0F172A',
  card: '#1E293B',
  cardShadow: 'rgba(0,0,0,0.3)',
  
  // Text colors
  text: '#F1F5F9',
  cardTitle: '#FFFFFF',
  textSecondary: '#aaaaaa',
  
  // Component colors
  switchThumb: '#475569',
  darkModeTrack: '#374151',
  
  // Device colors
  led: '#34D399',
  barrier: '#60A5FA',
  lamp: '#FBBF24',
  
  // Status colors
  detected: '#F87171',
  notDetected: '#34D399',
  gasDanger: '#F87171',
  gasOk: '#34D399',
  
  // Accent colors
  activeDot: '#A78BFA',
  notifActive: '#34D399',
  accent: '#A78BFA',

  // Door colors
  doorOpen: '#ff8787',
  doorClosed: '#69db7c',

  // Input colors
  inputBg: '#2e2e2e',
  inputBorder: '#555555',

  // Card item background
  cardItemBg: '#3e3e3e',
};

interface ThemeContextType {
  isDarkMode: boolean;
  theme: Theme;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('isDarkMode');
      if (savedTheme !== null) {
        setIsDarkMode(JSON.parse(savedTheme));
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newTheme = !isDarkMode;
      setIsDarkMode(newTheme);
      await AsyncStorage.setItem('isDarkMode', JSON.stringify(newTheme));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};