import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FirebaseApp,
  FirebaseOptions,
  getApps,
  initializeApp,
} from "firebase/app";
import type { Auth, Persistence, User, UserCredential } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { Platform } from "react-native";
import { publicEnv } from "@/config/publicEnv";

const getFirebaseConfig = (): FirebaseOptions => ({
  apiKey: publicEnv.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: publicEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: publicEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: publicEnv.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: publicEnv.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: publicEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: publicEnv.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
});

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let authReadyPromise: Promise<User | null> | null = null;

type ReactNativeAuthModule = {
  getAuth: (app?: FirebaseApp) => Auth;
  initializeAuth: (
    app: FirebaseApp,
    deps?: { persistence?: Persistence | Persistence[] },
  ) => Auth;
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  onIdTokenChanged: (
    auth: Auth,
    nextOrObserver: (user: User | null) => void,
    error?: (error: unknown) => void,
  ) => () => void;
  signInWithCustomToken: (
    auth: Auth,
    customToken: string,
  ) => Promise<UserCredential>;
  signInWithEmailAndPassword: (
    auth: Auth,
    email: string,
    password: string,
  ) => Promise<UserCredential>;
  signOut: (auth: Auth) => Promise<void>;
};

type WebAuthModule = Omit<ReactNativeAuthModule, "getReactNativePersistence">;

const getWebAuthModule = (): WebAuthModule => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("firebase/auth") as WebAuthModule;
};

const getReactNativeAuthModule = (): ReactNativeAuthModule => {
  // Use the public package entry so Metro can resolve the React Native export
  // condition without relying on a private deep import path.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@firebase/auth") as ReactNativeAuthModule;
};

const getFirebaseErrorCode = (error: unknown): string | null =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof (error as { code: unknown }).code === "string"
    ? ((error as { code: string }).code ?? null)
    : null;

export const isFirebaseConfigured = (): boolean => {
  const config = getFirebaseConfig();
  return !!(config.apiKey && config.projectId);
};

const initializeFirebaseAppInstance = (): FirebaseApp | null => {
  if (app) {
    return app;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    return app;
  }

  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    return null;
  }

  app = initializeApp(config);
  return app;
};

const initializeFirebaseAuthInstance = (firebaseApp: FirebaseApp): Auth => {
  if (auth) {
    return auth;
  }

  try {
    if (Platform.OS === "web") {
      auth = getWebAuthModule().getAuth(firebaseApp);
      return auth;
    }

    const reactNativeAuth = getReactNativeAuthModule();
    auth = reactNativeAuth.initializeAuth(firebaseApp, {
      persistence: reactNativeAuth.getReactNativePersistence(AsyncStorage),
    });
    return auth;
  } catch (error) {
    const errorCode = getFirebaseErrorCode(error);
    if (errorCode === "auth/already-initialized") {
      if (Platform.OS === "web") {
        auth = getWebAuthModule().getAuth(firebaseApp);
        return auth;
      }

      auth = getReactNativeAuthModule().getAuth(firebaseApp);
      return auth;
    }
    throw error;
  }
};

export const getFirebaseApp = (): FirebaseApp | null => {
  const firebaseApp = initializeFirebaseAppInstance();
  if (!firebaseApp) {
    return null;
  }

  initializeFirebaseAuthInstance(firebaseApp);
  return firebaseApp;
};

export const getFirebaseAuth = (): Auth | null => {
  const firebaseApp = initializeFirebaseAppInstance();
  if (!firebaseApp) {
    return null;
  }

  return initializeFirebaseAuthInstance(firebaseApp);
};

export const getFirestoreDatabase = (): Firestore | null => {
  if (firestore) {
    return firestore;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  firestore = getFirestore(firebaseApp);
  return firestore;
};

export const getFirebaseStorage = (): FirebaseStorage | null => {
  if (storage) {
    return storage;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  storage = getStorage(firebaseApp);
  return storage;
};

export const signInToFirebaseWithEmail = async (
  email: string,
  password: string,
): Promise<UserCredential> => {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error("Firebase authentication is not configured.");
  }

  if (Platform.OS === "web") {
    return getWebAuthModule().signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password,
    );
  }

  return getReactNativeAuthModule().signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password,
  );
};

export const signInToFirebaseWithCustomToken = async (
  customToken: string,
): Promise<UserCredential> => {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    throw new Error("Firebase authentication is not configured.");
  }

  if (Platform.OS === "web") {
    return getWebAuthModule().signInWithCustomToken(firebaseAuth, customToken);
  }

  return getReactNativeAuthModule().signInWithCustomToken(
    firebaseAuth,
    customToken,
  );
};

export const getFirebaseCurrentUser = (): User | null =>
  getFirebaseAuth()?.currentUser ?? null;

export const getFirebaseIdToken = async (
  forceRefresh = false,
): Promise<string | null> => {
  const currentUser = getFirebaseCurrentUser();
  if (!currentUser) {
    return null;
  }

  return currentUser.getIdToken(forceRefresh);
};

export const waitForFirebaseAuthReady = async (): Promise<User | null> => {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return null;
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise<User | null>((resolve, reject) => {
      const onTokenChanged =
        Platform.OS === "web"
          ? getWebAuthModule().onIdTokenChanged
          : getReactNativeAuthModule().onIdTokenChanged;

      const unsubscribe = onTokenChanged(
        firebaseAuth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        (error) => {
          unsubscribe();
          reject(error);
        },
      );
    }).finally(() => {
      authReadyPromise = null;
    });
  }

  return authReadyPromise;
};

export const signOutFromFirebase = async (): Promise<void> => {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return;
  }

  if (Platform.OS === "web") {
    await getWebAuthModule().signOut(firebaseAuth);
    return;
  }

  await getReactNativeAuthModule().signOut(firebaseAuth);
};
