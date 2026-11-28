import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

/**
 * Carga las fuentes Manrope desde el directorio de assets locales.
 *
 * Las fuentes se incluyen en el paquete de la app (no se descargan en tiempo de
 * ejecución desde Internet), cumpliendo el requisito de "no cargar fuentes desde
 * Internet en tiempo de ejecución".
 *
 * Solo se incluyen los pesos usados por los tokens tipográficos: 400, 500 y 700.
 * Se cargan como una familia para que `fontWeight` seleccione la cara correcta.
 */
const MANROPE_FONTS = [
  {
    fontFamily: 'Manrope',
    fontDefinitions: [
      { path: require('../../assets/fonts/Manrope-Regular.ttf'), weight: 400 },
      { path: require('../../assets/fonts/Manrope-Medium.ttf'), weight: 500 },
      { path: require('../../assets/fonts/Manrope-Bold.ttf'), weight: 700 },
    ],
  },
];

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
      } finally {
        // A font failure must never leave the app blocked on the loading screen.
        if (alive) setFontsLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { fontsLoaded, error };
}
