import json
import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

# Global Firestore client
_db = None

def initialize_firebase():
    global _db
    
    if _db is not None:
        return _db
    
    # Load credentials from settings (which reads from .env)
    firebase_creds = settings.firebase_credentials
    
    if not firebase_creds:
        raise ValueError(
            "FIREBASE_CREDENTIALS not set in .env. "
            "Add your Firebase service account JSON as a single-line string to .env"
        )
    
    try:
        cred_dict = json.loads(firebase_creds)
        cred = credentials.Certificate(cred_dict)
        print("Loaded Firebase credentials from .env")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in FIREBASE_CREDENTIALS: {e}")
    
    # Initialize Firebase app if not already initialized
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    _db = firestore.client()
    print("Connected to Firebase Firestore successfully")
    return _db


def get_database():
    global _db
    if _db is None:
        initialize_firebase()
    return _db


def close_firebase():
    global _db
    if _db is not None:
        _db = None
        print("Firebase connection closed")
