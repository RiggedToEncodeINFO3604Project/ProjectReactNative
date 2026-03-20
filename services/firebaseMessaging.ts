// =======================================================
// = Firebase Messaging Service                         =
// = Handles real-time message updates via Firestore    =
// =======================================================

import { Message } from "@/types/scheduling";
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  collection,
  Firestore,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  Unsubscribe,
} from "firebase/firestore";

// Firebase configuration from environment variables
const getFirebaseConfig = () => ({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
});

// Initialize Firebase only once
let app: FirebaseApp | undefined;
let db: Firestore | undefined;

const getFirebaseApp = (): FirebaseApp | null => {
  if (!app) {
    try {
      // Check if Firebase is already initialized
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
      } else {
        const config = getFirebaseConfig();
        // Validate config before initializing
        if (!config.apiKey || !config.projectId) {
          return null;
        }
        app = initializeApp(config);
      }
    } catch (error) {
      return null;
    }
  }
  return app;
};

const getFirestoreDatabase = (): Firestore | null => {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) {
      return null;
    }
    try {
      db = getFirestore(firebaseApp);
    } catch (error) {
      return null;
    }
  }
  return db;
};

// Callback type for receiving messages
export type FirebaseMessageCallback = (messages: Message[]) => void;

// Active subscription tracking
interface ActiveSubscription {
  unsubscribe: Unsubscribe;
  conversationId: string;
}

const activeSubscriptions: Map<string, ActiveSubscription> = new Map();

//Convert Firestore document to Message type
const convertDocToMessage = (doc: QueryDocumentSnapshot): Message => {
  const data = doc.data();
  // Handle Firestore Timestamp conversion for created_at
  let createdAt: string;
  if (data.created_at && typeof data.created_at.toDate === "function") {
    createdAt = data.created_at.toDate().toISOString();
  } else if (data.created_at) {
    createdAt = String(data.created_at);
  } else {
    createdAt = new Date().toISOString();
  }

  return {
    id: doc.id,
    conversation_id: data.conversation_id || "",
    sender_id: data.sender_id || "",
    sender_role: data.sender_role || "Customer",
    content: data.content || "",
    message_type: data.message_type || "text",
    created_at: createdAt,
    read: data.read || false,
    status: data.status || "sent",
    image_url: data.image_url,
  };
};

/**
 * Subscribe to real-time messages for a conversation
 * Uses Firestore onSnapshot for instant updates
 *
 * @param conversationId - The conversation ID to subscribe to
 * @param onMessages - Callback when messages are updated
 * @returns Unsubscribe function to stop listening
 */
export const subscribeToConversationMessages = (
  conversationId: string,
  onMessages: FirebaseMessageCallback,
): (() => void) => {
  // First, unsubscribe from any existing subscription for this conversation
  const existingSub = activeSubscriptions.get(conversationId);
  if (existingSub) {
    existingSub.unsubscribe();
    activeSubscriptions.delete(conversationId);
  }

  try {
    const firestore = getFirestoreDatabase();
    if (!firestore) {
      return () => {};
    }

    const messagesRef = collection(
      firestore,
      "conversations",
      conversationId,
      "messages",
    );

    // Query messages ordered by created_at ascending
    const queryConstraints: QueryConstraint[] = [orderBy("created_at", "asc")];

    const messagesQuery = query(messagesRef, ...queryConstraints);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages: Message[] = [];
        snapshot.forEach((doc) => {
          messages.push(convertDocToMessage(doc));
        });
        onMessages(messages);
      },
      (error) => {
        console.error("Error subscribing to messages:", error);
      },
    );

    // Store the subscription for cleanup
    activeSubscriptions.set(conversationId, {
      unsubscribe,
      conversationId,
    });

    // Return unsubscribe function
    return () => {
      const sub = activeSubscriptions.get(conversationId);
      if (sub) {
        sub.unsubscribe();
        activeSubscriptions.delete(conversationId);
      }
    };
  } catch (error) {
    // Return a no-op unsubscribe function
    return () => {};
  }
};

//Unsubscribe from a specific conversation
export const unsubscribeFromConversation = (conversationId: string): void => {
  const sub = activeSubscriptions.get(conversationId);
  if (sub) {
    sub.unsubscribe();
    activeSubscriptions.delete(conversationId);
  }
};

/**
 * Unsubscribe from all active subscriptions
 * Should be called when user logs out or app closes
 */
export const unsubscribeAll = (): void => {
  activeSubscriptions.forEach((sub) => {
    sub.unsubscribe();
  });
  activeSubscriptions.clear();
};

//Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  const config = getFirebaseConfig();
  return !!(config.apiKey && config.projectId);
};

export default {
  subscribeToConversationMessages,
  unsubscribeFromConversation,
  unsubscribeAll,
  isFirebaseConfigured,
};
