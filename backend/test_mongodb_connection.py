"""
Script to test MongoDB connection.
Used by first setup.bat to verify MongoDB Atlas connection.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from config import settings


async def test_connection():
    """Test MongoDB connection."""
    print(f"Testing connection to MongoDB...")
    print(f"URL: {settings.mongodb_url}")
    
    client = AsyncIOMotorClient(
        settings.mongodb_url,
        serverSelectionTimeoutMS=10000,  # 10 second timeout
        connectTimeoutMS=10000
    )
    
    try:
        await client.admin.command('ping')
        print("MongoDB connection successful!")
        return True
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    success = asyncio.run(test_connection())
    sys.exit(0 if success else 1)