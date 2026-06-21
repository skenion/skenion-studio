import type { MantineColorScheme, MantineColorSchemeManager } from "@mantine/core";

export const COLOR_SCHEME_STORAGE_KEY = "mantine-color-scheme-value";

function isMantineColorScheme(value: string | null | undefined): value is MantineColorScheme {
  return value === "auto" || value === "light" || value === "dark";
}

function readCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}

function writeCookieValue(name: string, value: MantineColorScheme) {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
}

export function normalizeColorScheme(value: string | null | undefined): MantineColorScheme | null {
  return isMantineColorScheme(value) ? value : null;
}

export function readColorSchemeCookie(
  cookieHeader: string,
  name = COLOR_SCHEME_STORAGE_KEY
): MantineColorScheme | null {
  return normalizeColorScheme(readCookieValue(cookieHeader, name));
}

export function createCookieBackedColorSchemeManager(
  key = COLOR_SCHEME_STORAGE_KEY
): MantineColorSchemeManager {
  let handleStorageEvent: ((event: StorageEvent) => void) | undefined;

  return {
    get: (defaultValue) => {
      if (typeof window === "undefined") {
        return defaultValue;
      }

      try {
        const cookieValue = readColorSchemeCookie(document.cookie, key);
        if (cookieValue) {
          window.localStorage.setItem(key, cookieValue);
          return cookieValue;
        }

        const localStorageValue = normalizeColorScheme(window.localStorage.getItem(key));
        if (localStorageValue) {
          writeCookieValue(key, localStorageValue);
          return localStorageValue;
        }
      } catch {
        return defaultValue;
      }

      return defaultValue;
    },

    set: (value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // noop
      }

      writeCookieValue(key, value);
    },

    subscribe: (onUpdate) => {
      handleStorageEvent = (event) => {
        if (event.storageArea === window.localStorage && event.key === key) {
          const nextValue = normalizeColorScheme(event.newValue);
          if (nextValue) {
            writeCookieValue(key, nextValue);
            onUpdate(nextValue);
          }
        }
      };

      window.addEventListener("storage", handleStorageEvent);
    },

    unsubscribe: () => {
      if (handleStorageEvent) {
        window.removeEventListener("storage", handleStorageEvent);
      }
    },

    clear: () => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // noop
      }

      if (typeof document !== "undefined") {
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${key}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
      }
    }
  };
}
