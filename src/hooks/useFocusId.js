import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { focusIdForParams } from '../services/focusRequest';

/**
 * Id of the item another screen asked us to reveal (the global search navigates here with
 * `{ focusId }`, so a single tap lands on the item instead of only on its section).
 *
 * The highlight expires on its own: `expired` holds the params object it was shown for, and
 * the value is derived while rendering (no setState inside an effect). Navigating again with
 * the same id creates a new params object, so the item lights up once more.
 */
export function useFocusRequest(timeout = 4000) {
  const route = useRoute();
  const params = route.params;
  const [expired, setExpired] = useState(null);

  const focusId = focusIdForParams(params, expired);

  useEffect(() => {
    if (!focusId || timeout == null) return undefined;
    const timer = setTimeout(() => setExpired(params), timeout);
    return () => clearTimeout(timer);
  }, [focusId, params, timeout]);

  return { focusId, request: params };
}

export function useFocusId(timeout = 4000) {
  return useFocusRequest(timeout).focusId;
}
