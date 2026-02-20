"""
FULL DISCLAIMER: I did AI this to just spit out information for baseline testing, I will be going back through and doing this over on my own so I can fully explain for the presentation
and I will be doing more comprehensive test data to fully display the system's capabilities.

Script to create test client records (bookings) for testing the customer snapshot feature.
This script:
1. Creates/uses existing test customer and provider from create_test_users.py
2. Creates sample services for the provider
3. Creates completed/confirmed bookings (client records) for the customer
4. Creates sample tags and notes for enhanced testing

Run this script to populate test data for snapshot testing:
  python create_test_bookings.py
"""

import asyncio
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database import connect_to_mongo, close_mongo_connection, get_database
from models import UserRole
from config import settings


async def create_test_bookings():
    """Create test bookings and related data for snapshot testing"""
    await connect_to_mongo()
    db = get_database()

    print("=" * 60)
    print("  Customer Snapshot Testing - Sample Data Creation")
    print("=" * 60)
    print()

    try:
        # Step 1: Get test customer
        print("[1/5] Retrieving test customer...")
        test_customer = await db.customers.find_one({"name": "Test Customer"})
        if not test_customer:
            print("  ❌ Test customer not found. Please run create_test_users.py first.")
            await close_mongo_connection()
            return

        customer_id = test_customer["_id"]
        customer_name = test_customer["name"]
        print(f"  ✓ Found: {customer_name} (ID: {customer_id})")
        print()

        # Step 2: Get test provider
        print("[2/5] Retrieving test provider...")
        test_provider = await db.providers.find_one(
            {"provider_name": "Test Provider"}
        )
        if not test_provider:
            print("  ❌ Test provider not found. Please run create_test_users.py first.")
            await close_mongo_connection()
            return

        provider_id = test_provider["_id"]
        provider_name = test_provider["provider_name"]
        print(f"  ✓ Found: {provider_name} (ID: {provider_id})")
        print()

        # Step 3: Create/verify services
        print("[3/5] Setting up services...")
        services = await db.services.find(
            {"provider_id": provider_id}
        ).to_list(100)

        service_ids = []
        if services:
            print(f"  ✓ Found {len(services)} existing service(s)")
            service_ids = [s["_id"] for s in services]
        else:
            print("  Creating new services...")
            service_names = [
                ("Haircut", "Professional haircut service", 35.00),
                ("Hair Styling", "Complete hair styling and treatment", 55.00),
                ("Beard Trim", "Precise beard trimming and shaping", 25.00),
            ]

            for service_name, description, price in service_names:
                service_id = str(uuid.uuid4())
                await db.services.insert_one(
                    {
                        "_id": service_id,
                        "provider_id": provider_id,
                        "name": service_name,
                        "description": description,
                        "price": price,
                    }
                )
                service_ids.append(service_id)
                print(f"    • {service_name} - ${price}")

        print()

        # Step 4: Create sample bookings (client records)
        print("[4/5] Creating sample bookings...")

        # Create bookings spanning the last 3 months
        bookings_created = 0
        booking_dates = [
            (datetime.now(timezone.utc) - timedelta(days=90), "Haircut"),
            (datetime.now(timezone.utc) - timedelta(days=60), "Hair Styling"),
            (datetime.now(timezone.utc) - timedelta(days=30), "Beard Trim"),
            (datetime.now(timezone.utc) - timedelta(days=15), "Haircut"),
            (datetime.now(timezone.utc) - timedelta(days=7), "Hair Styling"),
        ]

        service_map = {
            "Haircut": 35.00,
            "Hair Styling": 55.00,
            "Beard Trim": 25.00,
        }

        for booking_date, service_name in booking_dates:
            # Find the service ID
            service = await db.services.find_one(
                {"provider_id": provider_id, "name": service_name}
            )
            if not service:
                continue

            booking_id = str(uuid.uuid4())
            await db.client_records.insert_one(
                {
                    "_id": booking_id,
                    "customer_id": customer_id,
                    "service_id": service["_id"],
                    "date": booking_date,
                    "start_time": "14:00",
                    "end_time": "14:30",
                    "cost": service_map[service_name],
                    "status": "completed",  # Mark as completed so it shows in snapshot
                }
            )
            bookings_created += 1
            print(f"  ✓ {booking_date.strftime('%Y-%m-%d')}: {service_name}")

        print(f"  Total bookings created: {bookings_created}")
        print()

        # Step 5: Create sample tags and notes
        print("[5/5] Creating sample tags and notes...")

        # Create tags
        tags_data = [
            ("VIP Customer", "#f0c85a"),
            ("Loyal Client", "#34C759"),
            ("Prefers Evenings", "#007AFF"),
        ]

        tags_created = 0
        for tag_name, tag_color in tags_data:
            # Check if tag already exists
            existing_tag = await db.customer_tags.find_one(
                {
                    "customer_id": customer_id,
                    "provider_id": provider_id,
                    "tag": tag_name,
                }
            )
            if not existing_tag:
                await db.customer_tags.insert_one(
                    {
                        "_id": str(uuid.uuid4()),
                        "customer_id": customer_id,
                        "provider_id": provider_id,
                        "tag": tag_name,
                        "color": tag_color,
                        "created_at": datetime.now(timezone.utc),
                    }
                )
                tags_created += 1
                print(f"  ✓ Tag: {tag_name}")

        # Create notes
        notes_data = [
            "Prefers hot water wash before service",
            "Always books on Friday afternoons",
            "Allergic to certain hair products - use hypoallergenic line",
            "Likes to chat during appointments - friendly customer",
        ]

        notes_created = 0
        for note_text in notes_data:
            # Check if note already exists
            existing_note = await db.customer_notes.find_one(
                {
                    "customer_id": customer_id,
                    "provider_id": provider_id,
                    "note": note_text,
                }
            )
            if not existing_note:
                now = datetime.now(timezone.utc)
                await db.customer_notes.insert_one(
                    {
                        "_id": str(uuid.uuid4()),
                        "customer_id": customer_id,
                        "provider_id": provider_id,
                        "note": note_text,
                        "created_at": now,
                        "updated_at": now,
                    }
                )
                notes_created += 1
                print(f"  ✓ Note: {note_text}")

        print()
        print("=" * 60)
        print("  ✓ Test Data Created Successfully!")
        print("=" * 60)
        print()
        print("📋 TEST SUMMARY:")
        print(f"   Customer: {customer_name} (ID: {customer_id})")
        print(f"   Provider: {provider_name} (ID: {provider_id})")
        print(f"   Bookings Created: {bookings_created}")
        print(f"   Tags Created: {tags_created}")
        print(f"   Notes Created: {notes_created}")
        print()
        print("🔗 Test the Snapshot Feature:")
        print(f"   http://localhost:8001/snapshot?customerId={customer_id}") 
        print()
        print("Or test via API:")
        print(f"   GET http://localhost:8001/provider/customer/{customer_id}/snapshot")
        print("   (Requires valid provider auth token)")
        print()

    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(create_test_bookings())
