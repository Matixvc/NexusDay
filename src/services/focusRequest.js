export function focusIdForParams(params, expiredParams) {
  const incoming = params?.focusId ?? null;
  return incoming && params !== expiredParams ? incoming : null;
}
