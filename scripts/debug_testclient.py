import sys
print("Starting debug script...")
from backend.app.main import app
print("Imported app successfully.")
from fastapi.testclient import TestClient
print("Imported TestClient.")
client = TestClient(app)
print("Created TestClient.")
r = client.get("/api/health")
print("Response:", r.status_code, r.json())

