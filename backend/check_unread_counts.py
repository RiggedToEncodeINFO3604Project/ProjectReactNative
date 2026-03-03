"""
Diagnostic script to check unread count fields in Firestore
Run this to verify what fields exist in conversation documents
"""
from firebase_db import get_database

def check_conversations():
    db = get_database()
    conversations_ref = db.collection('conversations')
    docs = list(conversations_ref.limit(5).stream())
    
    print("=" * 60)
    print("CONVERSATION DOCUMENT FIELDS CHECK")
    print("=" * 60)
    
    for doc in docs:
        data = doc.to_dict()
        print(f"\nConversation ID: {doc.id}")
        print(f"  - customer_unread_count: {data.get('customer_unread_count', 'NOT SET')}")
        print(f"  - provider_unread_count: {data.get('provider_unread_count', 'NOT SET')}")
        print(f"  - unread_count: {data.get('unread_count', 'NOT SET')}")
        print(f"  - last_message exists: {data.get('last_message') is not None}")
        if data.get('last_message'):
            print(f"    sender: {data['last_message'].get('sender_role')} ({data['last_message'].get('sender_id')[:8]}...)")
    
    print("\n" + "=" * 60)
    print("ISSUE ANALYSIS:")
    print("=" * 60)
    print("""
The service code reads:
  data['unread_count'] = data.get('provider_unread_count', 0)
  or
  data['unread_count'] = data.get('customer_unread_count', 0)

But if 'provider_unread_count' and 'customer_unread_count' fields
are NOT in the database documents, the unread_count will ALWAYS be 0.

The fix is in send_message() - need to increment the counter when
a message is sent to the OTHER party.
""")

if __name__ == "__main__":
    check_conversations()
