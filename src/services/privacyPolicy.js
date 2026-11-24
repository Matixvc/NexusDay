export const PRIVATE_ACTIONS = Object.freeze({
  open: 'open',
  mutate: 'mutate',
  delete: 'delete',
  removePrivacy: 'remove-privacy',
});

export function isPrivateRecord(record) {
  return record?.private === true;
}

export function canExposeInList(record) {
  return !isPrivateRecord(record);
}

export function redactPrivateRecord(record, placeholder = {}) {
  if (canExposeInList(record)) return record;
  return { ...placeholder, id: record?.id, private: true };
}

export function filterDiscoverableRecords(records = []) {
  return records.filter(canExposeInList);
}

export function applyPrivacyFlag(record, value) {
  return value ? { ...record, private: true } : record;
}

export function requiresPrivateAuthentication(record, action, privacyEnabled = true) {
  if (!isPrivateRecord(record)) return false;
  if (action === PRIVATE_ACTIONS.open) return privacyEnabled !== false;
  if (
    action === PRIVATE_ACTIONS.mutate ||
    action === PRIVATE_ACTIONS.delete ||
    action === PRIVATE_ACTIONS.removePrivacy
  ) return true;
  return true;
}

export function requiresGlobalPrivacyAuthentication(currentValue, nextValue) {
  return currentValue !== false && nextValue === false;
}

export function createAuthorizationGate(authenticate) {
  let inFlight = false;

  return async function authorize(options) {
    if (inFlight) return { ok: false, reason: 'busy' };
    inFlight = true;
    try {
      const result = await authenticate(options);
      return result?.ok
        ? { ok: true, reason: null }
        : { ok: false, reason: result?.reason || 'error' };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      inFlight = false;
    }
  };
}

export async function runAuthorizedAction({ required, authorize, promptMessage, onAuthorized }) {
  if (required) {
    const result = await authorize({ promptMessage });
    if (!result.ok) return { ok: false, authenticated: false, reason: result.reason };
  }

  await onAuthorized();
  return { ok: true, authenticated: Boolean(required), reason: null };
}

export function createPrivacyAuthorizer(authenticate) {
  const authorize = createAuthorizationGate(authenticate);
  let actionInFlight = false;

  const execute = async (options) => {
    if (actionInFlight) return { ok: false, authenticated: false, reason: 'busy' };
    actionInFlight = true;
    try {
      return await runAuthorizedAction({ ...options, authorize });
    } finally {
      actionInFlight = false;
    }
  };

  return {
    authorizePrivateAction({ record, action, privacyEnabled, promptMessage, onAuthorized }) {
      return execute({
        required: requiresPrivateAuthentication(record, action, privacyEnabled),
        promptMessage,
        onAuthorized,
      });
    },
    authorizeGlobalPrivacyChange({ currentValue, nextValue, promptMessage, onAuthorized }) {
      return execute({
        required: requiresGlobalPrivacyAuthentication(currentValue, nextValue),
        promptMessage,
        onAuthorized,
      });
    },
  };
}
