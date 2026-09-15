import csv
import os
import time
import requests
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]
CSV_PATH = os.environ.get("CSV_PATH", "lignes_extremites.csv")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def osrm_route(lng_a, lat_a, lng_b, lat_b):
    url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{lng_a},{lat_a};{lng_b},{lat_b}"
        f"?overview=full&geometries=geojson"
    )
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok":
        return None
    return data["routes"][0]["geometry"]["coordinates"]

def coords_to_wkt(coords):
    pairs = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    return f"LINESTRING({pairs})"

ok = 0
fail = 0

with open(CSV_PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

total = len(rows)
print(f"Total: {total}")

for i, row in enumerate(rows, 1):
    name = row.get("name", "")
    try:
        lat_a = float(row["lat_a"])
        lng_a = float(row["lng_a"])
        lat_b = float(row["lat_b"])
        lng_b = float(row["lng_b"])
    except (TypeError, ValueError):
        print(f"[{i}/{total}] SKIP {name}")
        fail += 1
        continue

    print(f"[{i}/{total}] {name}")
    try:
        coords = osrm_route(lng_a, lat_a, lng_b, lat_b)
        if not coords or len(coords) < 2:
            print("  FAIL OSRM")
            fail += 1
        else:
            wkt = coords_to_wkt(coords)
            supabase.rpc(
                "update_line_geometry_wkt",
                {"p_id": row["id"], "p_wkt": wkt},
            ).execute()
            ok += 1
            print("  OK")
    except Exception as e:
        fail += 1
        print(f"  ERR {e}")

    time.sleep(1.2)

print(f"Done OK={ok} FAIL={fail}")
