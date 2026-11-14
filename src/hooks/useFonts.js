import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

/**
 * Carga las fuentes Manrope desde el directorio de assets locales.
 *
 * Las fuentes se incluyen en el paquete de la app (no se descargan en tiempo de
 * ejecución desde Internet), cumpliendo el requisito de "no cargar fuentes desde
 * Internet en tiempo de ejecución".
 *
 * Pesos configurados: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold),
 * 700 (Bold), 800 (ExtraBold).
 */
const MANROPE_FONTS = {
  Manrope: require('../../assets/fonts/Manrope-Regular.ttf'),
  'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('../../assets/fonts/Manrope-ExtraBold.ttf'),
  'Manrope-Light': require('../../assets/fonts/Manrope-Light.ttf'),
};

export function useFonts() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await Font.loadAsync(MANROPE_FONTS);
        if (alive) setFontsLoaded(true);
      } catch (err) {
        if (alive) setError(err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { fontsLoaded, error };
}