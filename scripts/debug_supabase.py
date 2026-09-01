import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://tskpfaqxqiqegwezovce.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWiqZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k"

req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/eas",
    headers={
        "apikey": SUPABASE_KEY.strip(),
        "Authorization": f"Bearer {SUPABASE_KEY.strip()}",
        "Content-Type": "application/json"
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status)
        print("Data:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.reason)
    print("Body:", e.read().decode('utf-8'))
