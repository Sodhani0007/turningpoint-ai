import os
import requests

url = "https://cricsheet.org/downloads/ipl_json.zip"
try:
    r = requests.head(url, timeout=10)
    print("Status:", r.status_code)
    print("Content-Length:", r.headers.get("content-length"))
except Exception as e:
    print("Error:", e)
