from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
import ssl

client = None
database = None

# Establish connection to MongoDB
async def connect_to_mongo():
    global client, database
    
    # Build connection kwargs with TLS settings for MongoDB Atlas
    kwargs = {
        "tls": True,
        "tlsAllowInvalidCertificates": False,
    }
    
    # If the URL already has tls=true, we don't need to add it again
    if "tls=" in settings.mongodb_url.lower():
        kwargs = {}
    
    try:
        client = AsyncIOMotorClient(settings.mongodb_url, **kwargs)
        database = client[settings.database_name]
        
        # Actually test the connection
        await client.admin.command('ping')
        print("Connected to MongoDB successfully")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        print(f"Please check your MONGODB_URL in .env file")
        print(f"Make sure MongoDB Atlas allows connections from this IP")

# Close MongoDB connection
async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


def get_database():
    return database
