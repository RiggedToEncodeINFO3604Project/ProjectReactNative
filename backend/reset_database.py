"""
Script to reset the MongoDB database.
Drops all collections and optionally recreates test users.
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def reset_database():
    # Create client with shorter timeout for faster feedback
    client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=5000,  # 5 second timeout
        connectTimeoutMS=5000
    )
    
    try:
        # Test connection first
        await client.admin.command('ping')
        print("Connected to MongoDB successfully")
        
        # Drop the database
        await client.drop_database(settings.database_name)
        print(f"Database '{settings.database_name}' dropped successfully!")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    print("Resetting database...")
    print(f"Connecting to: {settings.mongodb_url}")
    success = asyncio.run(reset_database())
    if success:
        print("Database reset complete.")
        sys.exit(0)
    else:
        print("Database reset failed.")
        sys.exit(1)
