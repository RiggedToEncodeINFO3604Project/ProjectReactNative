"""
Script to create test client records (bookings) for testing the customer snapshot feature.

This version uses the same firebase setup helpers as create_test_users.py
so it can be called from create test data.bat.
"""
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add parent directory to path for imports (same pattern as other scripts)
sys.path.insert(0, str(Path(__file__).parent))

from firebase_db import initialize_firebase, get_database


def create_test_bookings():
    """Create test bookings and related data for snapshot testing"""
    try:
        initialize_firebase()
        db = get_database()

        print("=" * 60)
        print("  Customer Snapshot Testing - Sample Data Creation")
        print("=" * 60)
        print()

        # Step 1: Get test customer
        print("[1/5] Retrieving test customer...")
        customers = db.collection("customers").where("name", "==", "Test Customer").get()
        test_customer = None
        for doc in customers:
            test_customer = doc.to_dict()
            test_customer["_id"] = doc.id
            break

        if not test_customer:
            print("  ❌ Test customer not found. Please run create_test_users.py first.")
            return False

        customer_id = test_customer["_id"]
        customer_name = test_customer.get("name", "<unknown>")
        print(f"  ✓ Found: {customer_name} (ID: {customer_id})")
        print()

        # Step 2: Get test provider
        print("[2/5] Retrieving test provider...")
        providers = db.collection("providers").where("provider_name", "==", "Test Provider").get()
        test_provider = None
        for doc in providers:
            test_provider = doc.to_dict()
            test_provider["_id"] = doc.id
            break

        if not test_provider:
            print("  ❌ Test provider not found. Please run create_test_users.py first.")
            return False

        provider_id = test_provider["_id"]
        provider_name = test_provider.get("provider_name", "<unknown>")
        print(f"  ✓ Found: {provider_name} (ID: {provider_id})")
        print()

        # Step 3: Create/verify services
        print("[3/5] Setting up services...")
        services_docs = db.collection("services").where("provider_id", "==", provider_id).get()

        service_ids = []
        # Build a map of service name -> document for quick lookup
        service_map = {}
        if services_docs and len(services_docs) > 0:
            print(f"  ✓ Found {len(services_docs)} existing service(s)")
            for doc in services_docs:
                sd = doc.to_dict()
                name = sd.get("name") or sd.get("service_name") or ""
                service_map[name.lower()] = {"id": doc.id, "data": sd}
            service_ids = [doc.id for doc in services_docs]
            print("  Existing services:")
            for k, v in service_map.items():
                print(f"    • {v['data'].get('name','<no-name>')} (id={v['id']})")
        else:
            print("  Creating new services...")
            service_names = [
                ("Haircut", "Professional haircut service", 35.00),
                ("Hair Styling", "Complete hair styling and treatment", 55.00),
                ("Beard Trim", "Precise beard trimming and shaping", 25.00),
            ]

            for service_name, description, price in service_names:
                service_id = str(uuid.uuid4())
                db.collection("services").document(service_id).set(
                    {
                        "_id": service_id,
                        "provider_id": provider_id,
                        "name": service_name,
                        "description": description,
                        "price": price,
                        "created_at": datetime.now(timezone.utc),
                    }
                )
                service_ids.append(service_id)
                service_map[service_name.lower()] = {"id": service_id, "data": {"name": service_name, "description": description, "price": price}}
                print(f"    • {service_name} - ${price}")

        print()

        # Step 4: Create sample bookings (client records)
        print("[4/5] Creating sample bookings...")

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
            svc_key = service_name.lower()
            svc_entry = service_map.get(svc_key)

            # If service does not exist in the provider's services, create it now
            if not svc_entry:
                print(f"  - Service '{service_name}' not found; creating new service for provider")
                new_service_id = str(uuid.uuid4())
                db.collection("services").document(new_service_id).set(
                    {
                        "_id": new_service_id,
                        "provider_id": provider_id,
                        "name": service_name,
                        "description": f"Auto-created service: {service_name}",
                        "price": service_map.get(service_name, 0.0) if isinstance(service_map, dict) else 0.0,
                        "created_at": datetime.now(timezone.utc),
                    }
                )
                svc_entry = {"id": new_service_id, "data": {"name": service_name}}
                service_map[svc_key] = svc_entry
                service_ids.append(new_service_id)

            booking_id = str(uuid.uuid4())
            db.collection("client_records").document(booking_id).set(
                {
                    "_id": booking_id,
                    "customer_id": customer_id,
                    "service_id": svc_entry["id"],
                    "date": booking_date,
                    "start_time": "14:00",
                    "end_time": "14:30",
                    "cost": service_map.get(service_name.lower(), {}).get("data", {}).get("price", service_map.get(service_name, 0.0)) if isinstance(service_map.get(service_name.lower(), {}), dict) else 0.0,
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc),
                }
            )
            bookings_created += 1
            print(f"  ✓ {booking_date.strftime('%Y-%m-%d')}: {service_name}")

        print(f"  Total bookings created: {bookings_created}")
        print()

        # Step 5: Create sample tags and notes
        print("[5/5] Creating sample tags and notes...")

        tags_data = [
            ("VIP Customer", "#f0c85a"),
            ("Loyal Client", "#34C759"),
            ("Prefers Evenings", "#007AFF"),
        ]

        tags_created = 0
        for tag_name, tag_color in tags_data:
            existing_tags = db.collection("customer_tags").where("customer_id", "==", customer_id).where("provider_id", "==", provider_id).where("tag", "==", tag_name).get()
            if not existing_tags or len(existing_tags) == 0:
                tag_id = str(uuid.uuid4())
                db.collection("customer_tags").document(tag_id).set(
                    {
                        "_id": tag_id,
                        "customer_id": customer_id,
                        "provider_id": provider_id,
                        "tag": tag_name,
                        "color": tag_color,
                        "created_at": datetime.now(timezone.utc),
                    }
                )
                tags_created += 1
                print(f"  ✓ Tag: {tag_name}")

        notes_data = [
            "Prefers hot water wash before service",
            "Always books on Friday afternoons",
            "Allergic to certain hair products - use hypoallergenic line",
            "Likes to chat during appointments - friendly customer",
        ]

        notes_created = 0
        for note_text in notes_data:
            existing_notes = db.collection("customer_notes").where("customer_id", "==", customer_id).where("provider_id", "==", provider_id).where("note", "==", note_text).get()
            if not existing_notes or len(existing_notes) == 0:
                note_id = str(uuid.uuid4())
                now = datetime.now(timezone.utc)
                db.collection("customer_notes").document(note_id).set(
                    {
                        "_id": note_id,
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

        return True

    except Exception as e:
        print(f"  ❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = create_test_bookings()
    sys.exit(0 if success else 1)
