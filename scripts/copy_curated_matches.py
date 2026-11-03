import os
import shutil

SOURCE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
DEST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "matches")
os.makedirs(DEST_DIR, exist_ok=True)

match_ids = ["1359487", "1181768", "1216527", "1254084"]
for mid in match_ids:
    src = os.path.join(SOURCE_DIR, f"{mid}.json")
    dst = os.path.join(DEST_DIR, f"{mid}.json")
    shutil.copy2(src, dst)
    print(f"Copied {src} -> {dst} ({os.path.getsize(dst)} bytes)")
