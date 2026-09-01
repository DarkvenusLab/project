import urllib.request
import urllib.error

url = "https://tskpfaqxqiqegwezovce.supabase.co/rest/v1/eas?select=*"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRza3BmYXF4cWlxZWd3ZXpvdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNjc0OTMsImV4cCI6MjEwMjk0MzQ5M30.-jIXmMNhbkOVb60FVhyPb4iSFSC9vj-7ieQxXFCH24k"

print("Key length:", len(key))
print("Key repr:", repr(key))

req = urllib.request.Request(url, headers={
    "apikey": key,
    "Authorization": f"Bearer {key}"
})

try:
    with urllib.request.urlopen(req) as resp:
        print("Success:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Response body:", e.read().decode('utf-8'))
