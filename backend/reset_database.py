"""
Script to reset the MongoDB database.
Drops all collections and optionally recreates test users.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def reset_database():
    client = AsyncIOMotorClient(settings.mongodb_url)
    
    try:
        # Drop the database
        await client.drop_database(settings.database_name)
        print(f"Database '{settings.database_name}' dropped successfully!")
        return True
    except Exception as e:
        print(f"Error dropping database: {e}")
        return False
    finally:
        await client.close()


if __name__ == "__main__":
    print("Resetting database...")
    success = asyncio.run(reset_database())
    if success:
        print("Database reset complete.")
    else:
        print("Database reset failed.")
