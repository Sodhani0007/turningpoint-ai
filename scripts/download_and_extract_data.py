import io
import os
import zipfile
import requests

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
os.makedirs(DATA_DIR, exist_ok=True)

url = "https://cricsheet.org/downloads/ipl_json.zip"
print(f"Downloading IPL data from {url}...")
response = requests.get(url, timeout=60)
response.raise_for_status()

print(f"Downloaded {len(response.content)} bytes. Extracting to {DATA_DIR}...")
with zipfile.ZipFile(io.BytesIO(response.content)) as z:
    z.extractall(DATA_DIR)

files = [f for f in os.listdir(DATA_DIR) if f.endswith(".json")]
print(f"Extracted {len(files)} JSON match files successfully.")
