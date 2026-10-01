import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Privacy lock for private notes and expenses (SDK 57 `expo-local-authentication`).
 *
 * The lock is the one the phone already knows: fingerprint / Face ID, and when there is no
 * biometric enrolled the OS falls back to the device passcode (PIN, pattern or password).
 * That fallback is left enabled on purpose — `disableDeviceFallback: false` is the secure
 * path: it hands over to the system credential UI instead of failing silently.
 *
 * Nothing is stored by the app: the OS keeps the biometrics, this module only asks.
 */

const AUTH_TYPES = {
  [LocalAuthentication.AuthenticationType.FINGERPRINT]: 'Huella',
  [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]: 'Rostro',
  [LocalAuthentication.AuthenticationType.IRIS]: 'Iris',
};

export function isSupported() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

let capabilityCache = null;

/**
 * What the device can do, cached for the session: `{ available, hasHardware, enrolled,
 * types, label, reason }`. Any failure (Expo Go without the native module included) resolves
 * to `available: false` instead of throwing, so the UI can stay quiet.
 */
export async function getCapability({ refresh = false } = {}) {
  if (capabilityCache && !refresh) return capabilityCache;
  if (!isSupported()) {
    return (capabilityCache = { available: false, hasHardware: false, enrolled: false, types: [], label: 'No disponible', reason: 'unsupported' });
  }
  try {
    const [hasHardware, types, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    const names = types.map((type) => AUTH_TYPES[type]).filter(Boolean);
    return (capabilityCache = {
      available: hasHardware && enrolled,
      hasHardware,
      enrolled,
      types,
      label: names.length ? names.join(' / ') : 'PIN del teléfono',
      reason: !hasHardware ? 'no-hardware' : !enrolled ? 'not-enrolled' : null,
    });
  } catch (error) {
    // The native module is not linked (Expo Go): behave as "no biometric", device passcode only.
    console.warn('[privacy] local authentication is unavailable', error);
    return (capabilityCache = {
      available: false,
      hasHardware: false,
      enrolled: false,
      types: [],
      label: 'PIN del teléfono',
      reason: 'missing-native-module',
    });
  }
}

const REASONS = {
  unsupported: 'Este dispositivo no admite autenticación del sistema.',
  'no-hardware': 'El teléfono no tiene lector de huella ni reconocimiento facial.',
  'not-enrolled': 'No hay huella o rostro configurado: se usará el PIN del teléfono.',
  'missing-native-module': 'expo-local-authentication necesita una versión de desarrollo de la app.',
  cancelled: 'Autenticación cancelada.',
  fallback: 'No se pudo autenticar. Prueba de nuevo.',
  error: 'Error de autenticación: intenta otra vez.',
};

/**
 * Shows the native prompt. Resolves `{ ok, reason }` and never throws, so callers can simply
 * branch on `ok`. `disableDeviceFallback: false` keeps the device passcode as the fallback.
 */
export async function authenticate({ promptMessage = 'Desbloquea para ver el contenido privado', cancelLabel = 'Cancelar' } = {}) {
  const capability = await getCapability();
  // Only "this device cannot authenticate at all" stops here. When there is no biometric
  // enrolled the prompt below is still shown: the OS then asks for the device passcode.
  if (capability.reason === 'unsupported') return { ok: false, reason: 'unsupported' };

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: false,
    });
    if (result.success) return { ok: true, reason: null };
    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: result.error === 'not_enrolled' ? 'not-enrolled' : 'error' };
  } catch (error) {
    console.warn('[privacy] authenticateAsync failed', error);
    return { ok: false, reason: 'error' };
  }
}

/** Human readable explanation for a failed attempt. */
export function describePrivacyFailure(reason) {
  return REASONS[reason] || REASONS.error;
}

/** Short label for the Settings row ("Huella / Rostro", "PIN del teléfono", …). */
export async function describeCapability() {
  const capability = await getCapability();
  if (capability.available) return `Activo · ${capability.label}`;
  if (capability.reason === 'not-enrolled') return 'Sin datos biométricos · usará el PIN';
  if (capability.reason === 'unsupported' || capability.reason === 'missing-native-module') {
    return 'Requiere una versión de desarrollo';
  }
  return 'Se usará el PIN del teléfono';
}
