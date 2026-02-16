from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

client = None
database = None

# Establish connection to MongoDB
async def connect_to_mongo():
    global client, database
    client = AsyncIOMotorClient(settings.mongodb_url)
    database = client[settings.database_name]
    
    # Actually test the connection
    try:
        await client.admin.command('ping')
        print("Connected to MongoDB successfully")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        print(f"Please check your MONGODB_URL in .env file")

# Close MongoDB connection
async def close_mongo_connection():
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


def get_database():
    return database
