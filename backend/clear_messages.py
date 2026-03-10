"""
Script to clear all messaging data from Firebase Firestore.
Deletes all documents from conversations and messages collections.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from firebase_db import initialize_firebase, get_database
from firebase_admin import firestore


def clear_messages():
    """
    Clear all messaging data from Firebase Firestore.
    Deletes all documents from 'conversations' and 'messages' collections.
    Uses batch operations for efficient deletion (max 500 operations per batch).
    """
    try:
        initialize_firebase()
        db = get_database()
        
        collections = ["conversations", "messages"]
        
        for collection_name in collections:
            print(f"Deleting documents from '{collection_name}' collection...")
            
            # Get all documents in the collection
            docs = db.collection(collection_name).stream()
            doc_count = 0
            
            # Use batch operations (max 500 operations per batch)
            batch = db.batch()
            batch_count = 0
            
            for doc in docs:
                batch.delete(doc.reference)
                doc_count += 1
                batch_count += 1
                
                # Commit batch when reaching 500 operations
                if batch_count >= 500:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
            
            # Commit any remaining operations
            if batch_count > 0:
                batch.commit()
            
            print(f"  - Deleted {doc_count} documents from '{collection_name}'")
        
        print("\nMessaging data cleared successfully!")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False


if __name__ == "__main__":
    print("Clearing messaging data from Firebase Firestore...")
    print("This will delete all conversations and messages.")
    print()
    success = clear_messages()
    if success:
        sys.exit(0)
    else:
        print("Failed to clear messaging data.")
        sys.exit(1)
