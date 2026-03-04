const STORAGE_KEY = "portfolio_admin_api_key";

let cachedAdminApiKey: string | null = null;

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export const getAdminApiKey = () => {
  if (cachedAdminApiKey) return cachedAdminApiKey;
  if (!canUseStorage()) return "";

  cachedAdminApiKey = window.sessionStorage.getItem(STORAGE_KEY);
  return cachedAdminApiKey ?? "";
};

export const hasAdminApiKey = () => getAdminApiKey().length > 0;

export const setAdminApiKey = (value: string) => {
  const trimmed = value.trim();
  cachedAdminApiKey = trimmed.length > 0 ? trimmed : null;

  if (!canUseStorage()) return;

  if (cachedAdminApiKey) {
    window.sessionStorage.setItem(STORAGE_KEY, cachedAdminApiKey);
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
};

export const clearAdminApiKey = () => {
  cachedAdminApiKey = null;
  if (!canUseStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
};
