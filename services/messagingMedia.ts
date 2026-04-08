import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { Platform } from "react-native";

export interface SelectedMessageImage {
  file?: Blob;
  mimeType: string;
  name: string;
  uri?: string;
}

const getFirebaseConfig = () => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
});

const getFirebaseApp = (): FirebaseApp | null => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId || !config.storageBucket) {
    return null;
  }

  return initializeApp(config);
};

const sanitizeFileName = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]/g, "-");

const readUriAsBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Unable to read selected image");
  }

  return response.blob();
};

export const pickMessageImageFromDevice =
  async (): Promise<SelectedMessageImage | null> => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return null;
    }

    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        resolve({
          file,
          mimeType: file.type || "image/jpeg",
          name: file.name || `message-image-${Date.now()}.jpg`,
        });
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  };

export const uploadMessagingImage = async (
  image: SelectedMessageImage,
  conversationId: string,
  senderId: string,
): Promise<string> => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    throw new Error("Firebase storage is not configured");
  }

  const storage = getStorage(firebaseApp);
  const fileName = sanitizeFileName(image.name || `message-${Date.now()}.jpg`);
  const storageRef = ref(
    storage,
    `messages/${conversationId}/${senderId}/${Date.now()}-${fileName}`,
  );

  const fileBlob =
    image.file || (image.uri ? await readUriAsBlob(image.uri) : null);

  if (!fileBlob) {
    throw new Error("No image file was provided");
  }

  await uploadBytes(storageRef, fileBlob, {
    contentType: image.mimeType || "image/jpeg",
  });

  return getDownloadURL(storageRef);
};
