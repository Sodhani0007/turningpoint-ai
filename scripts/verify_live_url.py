import requests

urls = [
    "https://frontend-mauve-omega-75.vercel.app",
    "https://frontend-6khghqi5z-sodhani0007.vercel.app"
]

for url in urls:
    try:
        r = requests.get(url, timeout=10)
        print(f"URL: {url}")
        print(f"Status: {r.status_code}")
        print(f"Headers Content-Type: {r.headers.get('content-type')}")
        print(f"Contains TurningPoint: {'TurningPoint' in r.text or 'root' in r.text}")
        print(f"HTML snippet: {r.text[:200]}")
        print("-" * 50)
    except Exception as e:
        print(f"Error fetching {url}: {e}")

