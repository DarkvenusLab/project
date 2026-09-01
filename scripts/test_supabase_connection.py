import json
import urllib.request

SUPABASE_URL = "https://tskpfaqxqiqegwezovce.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWiqZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k"

def test_connection():
    url = f"{SUPABASE_URL}/rest/v1/eas?select=*"
    req = urllib.request.Request(url, headers={
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    })
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            print("Successfully connected to Supabase!")
            print(f"Total EAs in database: {len(data)}")
            for ea in data:
                print(f"- ID: {ea['id']} | Name: {ea['name']} | Pair: {ea['currency_pair']} | Price: {ea['price_text']}")
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    test_connection()
