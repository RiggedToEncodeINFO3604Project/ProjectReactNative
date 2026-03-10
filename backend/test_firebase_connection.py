"""
Script to test Firebase Firestore connection.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from firebase_db import initialize_firebase, get_database


def test_firebase_connection():
    try:
        print("Testing Firebase connection...")
        db = initialize_firebase()
        print("✅ Successfully connected to Firebase Firestore!")
        
        # Try to list a collection (users) to verify connection works
        users_ref = db.collection("users")
        docs = users_ref.limit(1).get()
        print("✅ Firebase connection verified - can access database")
        
        return True
        
    except Exception as e:
        print(f"❌ Firebase connection test failed: {e}")
        print()
        print("Tips for troubleshooting:")
        print("1. Make sure your FIREBASE_CREDENTIALS environment variable is set")
        print("2. Verify that the Firebase service account JSON is valid")
        print("3. Check that you have internet access")
        print("4. Ensure the Firebase project is active and Firestore is enabled")
        return False


if __name__ == "__main__":
    success = test_firebase_connection()
    sys.exit(0 if success else 1)
