"""
Script to create test users for the scheduling service.
Run this script to create test accounts:
  - testc (customer) with password 123
  - testp (provider) with password 123
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import connect_to_mongo, close_mongo_connection, get_database
from auth import get_password_hash
from models import UserCreate, CustomerCreate, ProviderCreate
from config import settings


async def create_test_users():
    await connect_to_mongo()
    db = get_database()
    
    print("Creating test users...")
    
    # Create test customer
    customer_user = {
        "email": "testc@test.com",
        "password": get_password_hash("123"),
        "role": "Customer",
    }
    
    # Check if customer already exists
    existing_customer = await db.users.find_one({"email": "testc@test.com"})
    if existing_customer:
        print("  - testc (customer) already exists")
        customer_id = existing_customer["_id"]
    else:
        result = await db.users.insert_one(customer_user)
        customer_id = result.inserted_id
        
        # Create customer profile
        customer_profile = {
            "user_id": str(customer_id),
            "name": "Test Customer",
            "phone": "555-0001",
            "payment_type": "Cash",
        }
        await db.customers.insert_one(customer_profile)
        print("  ✓ Created testc (customer) - password: 123")
    
    # Create test provider
    provider_user = {
        "email": "testp@test.com",
        "password": get_password_hash("123"),
        "role": "Provider",
    }
    
    # Check if provider already exists
    existing_provider = await db.users.find_one({"email": "testp@test.com"})
    if existing_provider:
        print("  - testp (provider) already exists")
        provider_id = existing_provider["_id"]
    else:
        result = await db.users.insert_one(provider_user)
        provider_id = result.inserted_id
        
        # Create provider profile
        provider_profile = {
            "user_id": str(provider_id),
            "business_name": "Test Provider Services",
            "bio": "A test provider account for development",
            "address": "123 Test Street",
            "is_active": True,
        }
        await db.providers.insert_one(provider_profile)
        print("  ✓ Created testp (provider) - password: 123")
        
        # Add a sample service for the provider
        service = {
            "provider_id": str(provider_id),
            "name": "Test Service",
            "description": "A sample service for testing",
            "price": 50.0,
        }
        await db.services.insert_one(service)
        print("  ✓ Added sample service for testp")
    
    await close_mongo_connection()
    print("\nTest users created successfully!")
    print("\nLogin credentials:")
    print("  Customer: testc@test.com / 123")
    print("  Provider: testp@test.com / 123")


if __name__ == "__main__":
    asyncio.run(create_test_users())
