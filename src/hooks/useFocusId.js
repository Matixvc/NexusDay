import { useEffect, useState } from 'react';
import { useRoute } from '@react-navigation/native';

/**
 * Id of the item another screen asked us to reveal (the global search navigates here with
 * `{ focusId }`, so a single tap lands on the item instead of only on its section).
 *
 * The highlight expires on its own: `expired` holds the params object it was shown for, and
 * the value is derived while rendering (no setState inside an effect). Navigating again with
 * the same id creates a new params object, so the item lights up once more.
 */
export function useFocusId(timeout = 4000) {
  const route = useRoute();
  const params = route.params;
  const incoming = params?.focusId ?? null;
  const [expired, setExpired] = useState(null);

  const focusId = incoming && incoming !== expired ? incoming : null;

  useEffect(() => {
    if (!focusId) return undefined;
    const timer = setTimeout(() => setExpired(params), timeout);
    return () => clearTimeout(timer);
  }, [focusId, params, timeout]);

  return focusId;
}
