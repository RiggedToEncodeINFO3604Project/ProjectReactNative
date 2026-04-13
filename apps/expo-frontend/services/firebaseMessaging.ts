// =======================================================
// = Firebase Messaging Service                         =
// = Handles real-time message updates via Firestore    =
// =======================================================

import { Message } from "@/types/scheduling";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  QueryConstraint,
  QueryDocumentSnapshot,
  Unsubscribe,
} from "firebase/firestore";
import {
  getFirestoreDatabase,
  isFirebaseConfigured,
} from "@/services/firebaseClient";

export { isFirebaseConfigured };

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
  } catch {
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

export default {
  subscribeToConversationMessages,
  unsubscribeFromConversation,
  unsubscribeAll,
  isFirebaseConfigured,
};
