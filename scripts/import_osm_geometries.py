import json
import os
import re
import time
from pathlib import Path

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_ANON_KEY"]
DATA_DIR = Path(os.environ.get("DATA_DIR", "data"))

FILES = [
    DATA_DIR / "interpreter (15).json",
    DATA_DIR / "interpreter (16).json",
]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def norm_name(s: str) -> str:
    s = (s or "").lower().strip()
    s = s.replace("woro-woro", "woro woro")
    s = s.replace("→", "->").replace("↔", "<->")
    s = re.sub(r"\s+", " ", s)
    return s


def relation_to_coords(rel: dict):
    coords = []
    for m in rel.get("members") or []:
        if m.get("type") != "way":
            continue
        for p in m.get("geometry") or []:
            lat, lon = p.get("lat"), p.get("lon")
            if lat is None or lon is None:
                continue
            pt = (float(lon), float(lat))
            if coords and coords[-1] == pt:
                continue
            coords.append(pt)
    return coords


def coords_to_wkt(coords):
    if len(coords) < 2:
        return None
    pairs = ", ".join(f"{lng} {lat}" for lng, lat in coords)
    return f"LINESTRING({pairs})"


def load_supabase_lines():
    rows = []
    start = 0
    page = 1000
    while True:
        r = (
            supabase.table("transport_lines")
            .select("id,name,osm_id")
            .range(start, start + page - 1)
            .execute()
        )
        data = r.data or []
        rows.extend(data)
        if len(data) < page:
            break
        start += page

    by_osm = {}
    by_name = {}
    for row in rows:
        if row.get("osm_id") is not None:
            by_osm[int(row["osm_id"])] = row
        n = norm_name(row.get("name") or "")
        if n and n not in by_name:
            by_name[n] = row
    return by_osm, by_name, len(rows)


def main():
    by_osm, by_name, total_sb = load_supabase_lines()
    print(f"Supabase lines: {total_sb} | names: {len(by_name)} | osm_id: {len(by_osm)}")

    ok = fail = skip = no_match = 0
    seen_osm = set()

    for path in FILES:
        if not path.exists():
            print(f"MISSING {path}")
            continue
        print(f"Reading {path.name} ...")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        for rel in data.get("elements") or []:
            if rel.get("type") != "relation":
                continue

            osm_id = rel.get("id")
            if osm_id is None or osm_id in seen_osm:
                continue
            seen_osm.add(osm_id)

            tags = rel.get("tags") or {}
            name = tags.get("name")
            if not name:
                skip += 1
                continue

            coords = relation_to_coords(rel)
            wkt = coords_to_wkt(coords)
            if not wkt:
                fail += 1
                continue

            row = by_osm.get(int(osm_id))
            if not row:
                row = by_name.get(norm_name(name))

            if not row:
                no_match += 1
                continue

            try:
                supabase.rpc(
                    "update_line_geometry_and_osm",
                    {
                        "p_id": row["id"],
                        "p_wkt": wkt,
                        "p_osm_id": int(osm_id),
                    },
                ).execute()
                ok += 1
                if ok <= 15 or ok % 50 == 0:
                    print(f"OK [{ok}] {name[:60]}")
            except Exception as e:
                fail += 1
                print(f"ERR {name[:40]} → {e}")

            time.sleep(0.05)

    print(f"\nDone OK={ok} FAIL={fail} NO_MATCH={no_match} SKIP={skip}")


if __name__ == "__main__":
    main()
