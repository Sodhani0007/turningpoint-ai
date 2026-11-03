import requests
import re

url = "https://frontend-mauve-omega-75.vercel.app"
r = requests.get(url, timeout=10)
print(f"Status: {r.status_code}")

# Find script src
matches = re.findall(r'src="(/assets/[^"]+)"', r.text)
print("Asset scripts found:", matches)
for script_path in matches:
    asset_url = url + script_path
    ar = requests.get(asset_url, timeout=10)
    print(f"Asset: {asset_url} -> Status: {ar.status_code}, Length: {len(ar.content)} bytes")

