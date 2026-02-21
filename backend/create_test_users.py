"""
Script to create test users for the scheduling service.
Run this script to create test accounts:
  - testc (customer) with password 123
  - testp (provider) with password 123
"""

import asyncio
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import connect_to_mongo, close_mongo_connection, get_database
from auth import get_password_hash
from models import UserCreate, CustomerCreate, ProviderCreate, UserRole
from config import settings


async def create_test_users():
    await connect_to_mongo()
    db = get_database()
    
    print("Creating test users...")
    
    # Create test customer with string UUID (matching auth_routes.py format)
    customer_id = str(uuid.uuid4())
    customer_user = {
        "_id": customer_id,
        "email": "testc@test.com",
        "password": get_password_hash("123"),
        "role": "Customer",
        "created_at": datetime.now(timezone.utc),
        "last_login": None,
    }
    
    # Check if customer already exists
    existing_customer = await db.users.find_one({"email": "testc@test.com"})
    if existing_customer:
        print("  - testc (customer) already exists")
    else:
        await db.users.insert_one(customer_user)
        
        # Create customer profile
        customer_profile = {
            "_id": str(uuid.uuid4()),
            "user_id": customer_id,
            "name": "Test Customer",
            "phone": "555-0001",
        }
        await db.customers.insert_one(customer_profile)
        print("  [OK] Created testc (customer) - password: 123")
    
    # Create test provider with string UUID (matching auth_routes.py format)
    provider_id = str(uuid.uuid4())
    provider_user = {
        "_id": provider_id,
        "email": "testp@test.com",
        "password": get_password_hash("123"),
        "role": "Provider",
        "created_at": datetime.now(timezone.utc),
        "last_login": None,
    }
    
    # Check if provider already exists
    existing_provider = await db.users.find_one({"email": "testp@test.com"})
    if existing_provider:
        print("  - testp (provider) already exists")
    else:
        await db.users.insert_one(provider_user)
        
        # Create provider profile
        provider_profile = {
            "_id": str(uuid.uuid4()),
            "user_id": provider_id,
            "provider_name": "Test Provider",
            "business_name": "Test Provider Services",
            "bio": "A test provider account for development",
            "provider_address": "123 Test Street",
            "is_active": True,
        }
        await db.providers.insert_one(provider_profile)
        print("  [OK] Created testp (provider) - password: 123")
        
        # Add a sample service for the provider
        service = {
            "_id": str(uuid.uuid4()),
            "provider_id": provider_id,
            "name": "Test Service",
            "description": "A sample service for testing",
            "price": 50.0,
        }
        await db.services.insert_one(service)
        print("  [OK] Added sample service for testp")
    
    await close_mongo_connection()
    print("\nTest users created successfully!")
    print("\nLogin credentials:")
    print("  Customer: testc@test.com / 123")
    print("  Provider: testp@test.com / 123")


if __name__ == "__main__":
    asyncio.run(create_test_users())
