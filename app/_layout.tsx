import { Slot } from 'expo-router';
import { ThemeProvider } from '../lib/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
    
      <Slot />
    </ThemeProvider>
  );
}
