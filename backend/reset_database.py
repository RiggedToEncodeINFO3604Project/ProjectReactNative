"""
Script to reset the Firebase Firestore database.
Deletes all documents from each collection.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from firebase_db import initialize_firebase, get_database
from firebase_admin import firestore


def reset_database():
    """
    Reset the Firebase Firestore database by deleting all documents.
    Uses batch operations for efficient deletion (max 500 operations per batch).
    """
    try:
        initialize_firebase()
        db = get_database()
        
        collections = ["users", "customers", "providers", "services", "availability", "client_records"]
        
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
        
        print("\nDatabase reset complete!")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False


if __name__ == "__main__":
    print("Resetting Firebase Firestore database...")
    print()
    success = reset_database()
    if success:
        sys.exit(0)
    else:
        print("Database reset failed.")
        sys.exit(1)
