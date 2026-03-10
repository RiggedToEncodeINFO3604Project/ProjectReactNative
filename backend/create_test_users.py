"""
Script to create test users for the scheduling service.
Run this script to create test accounts:
  - testc@test.com (customer) with password 123
  - testp@test.com (provider) with password 123
"""

import sys
import os
import uuid
from datetime import datetime, timezone
import warnings

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from firebase_db import initialize_firebase, get_database
from auth import get_password_hash

# Suppress the filter deprecation warning
warnings.filterwarnings("ignore", message="Detected filter using positional arguments")


def create_test_users():
    """
    Create test users (customer and provider) in Firebase Firestore.
    """
    try:
        initialize_firebase()
        db = get_database()
        
        print("Creating test users...")
        print()
        
        # Create test customer
        customer_email = "testc@test.com"
        customer_password = "123"
        
        # Check if customer already exists
        existing_customer = db.collection("users").where("email", "==", customer_email).get()
        if existing_customer:
            print(f"  - Customer '{customer_email}' already exists")
        else:
            customer_id = str(uuid.uuid4())
            
            # Create user document
            customer_user = {
                "email": customer_email,
                "password": get_password_hash(customer_password),
                "role": "Customer",
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
            }
            db.collection("users").document(customer_id).set(customer_user)
            
            # Create customer profile
            customer_profile = {
                "user_id": customer_id,
                "name": "Test Customer",
                "phone": "1234567890",
            }
            db.collection("customers").document(customer_id).set(customer_profile)
            print(f"  [OK] Created customer '{customer_email}' - password: {customer_password}")
        
        # Create test provider
        provider_email = "testp@test.com"
        provider_password = "123"
        
        # Check if provider already exists
        existing_provider = db.collection("users").where("email", "==", provider_email).get()
        if existing_provider:
            print(f"  - Provider '{provider_email}' already exists")
        else:
            provider_id = str(uuid.uuid4())
            
            # Create user document
            provider_user = {
                "email": provider_email,
                "password": get_password_hash(provider_password),
                "role": "Provider",
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
            }
            db.collection("users").document(provider_id).set(provider_user)
            
            # Create provider profile
            provider_profile = {
                "user_id": provider_id,
                "provider_name": "Test Provider",
                "business_name": "Test Business",
                "bio": "Test bio",
                "provider_address": "Test Address",
                "is_active": True,
            }
            db.collection("providers").document(provider_id).set(provider_profile)
            print(f"  [OK] Created provider '{provider_email}' - password: {provider_password}")
            
            # Add a sample service for the provider
            service_id = str(uuid.uuid4())
            service = {
                "provider_id": provider_id,
                "name": "Test Service",
                "description": "A sample service for testing",
                "price": 50.0,
                "duration": 60,
                "created_at": datetime.now(timezone.utc),
            }
            db.collection("services").document(service_id).set(service)
            print(f"  [OK] Added sample service for test provider")
        
        print()
        print("Test users created successfully!")
        print()
        print("Login credentials:")
        print(f"  Customer: {customer_email} / {customer_password}")
        print(f"  Provider: {provider_email} / {provider_password}")
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False


if __name__ == "__main__":
    success = create_test_users()
    if success:
        sys.exit(0)
    else:
        print("Failed to create test users.")
        sys.exit(1)
