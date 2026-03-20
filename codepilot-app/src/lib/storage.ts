import AsyncStorage from "@react-native-async-storage/async-storage";

const CREDENTIALS_KEY = "codepilot_credentials";

export interface SavedCredentials {
  host: string;
  port: number;
  token: string;
}

export async function saveCredentials(creds: SavedCredentials): Promise<void> {
  await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
}

export async function loadCredentials(): Promise<SavedCredentials | null> {
  const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedCredentials;
  } catch {
    return null;
  }
}

export async function clearCredentials(): Promise<void> {
  await AsyncStorage.removeItem(CREDENTIALS_KEY);
}
