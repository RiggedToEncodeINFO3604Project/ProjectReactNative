"""
Script to check if user password is correctly hashed.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import connect_to_mongo, close_mongo_connection, get_database
from auth import verify_password, get_password_hash


async def check_user():
    await connect_to_mongo()
    db = get_database()
    
    # Find the test customer
    user = await db.users.find_one({"email": "testc@test.com"})
    
    if not user:
        print("User testc@test.com not found!")
        return
    
    print(f"User found: {user['email']}")
    print(f"Role: {user['role']}")
    print(f"Password hash (first 50 chars): {user['password'][:50]}...")
    
    # Test password verification
    test_result = verify_password("123", user["password"])
    print(f"Password '123' verifies: {test_result}")
    
    if not test_result:
        print("\nPassword verification failed. Recreating user...")
        # Delete existing user and customer profile
        await db.users.delete_one({"email": "testc@test.com"})
        await db.customers.delete_one({"user_id": str(user["_id"])})
        
        # Recreate with correct password hash
        new_hash = get_password_hash("123")
        print(f"New hash: {new_hash[:50]}...")
        
        # Verify new hash works
        new_verify = verify_password("123", new_hash)
        print(f"New hash verifies: {new_verify}")
    
    await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(check_user())