"""
HerVoice — Database Seeder
Imports synthetic training data from CSV into the PostgreSQL database.

Usage:
    python seed_data.py

Reads: HerVoice_ML/hervoice_ml_training_data_12.csv
Writes to: ratings, tags, rating_tags, grid_cells tables
"""

import csv
import uuid
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

# ── Config ────────────────────────────────────────────────────────────────────
DB_DSN = "dbname=hervoice user=postgres password=postgres host=localhost port=5432"
CSV_FILE = Path(__file__).resolve().parent.parent / "HerVoice_ML" / "hervoice_ml_training_data_12.csv"

# ── Geohash decode (minimal copy to avoid import issues) ──────────────────────
CHARS = '0123456789bcdefghjkmnpqrstuvwxyz'

def decode_hash(geohash: str) -> dict:
    even = True
    lat_range = [-90.0, 90.0]
    lng_range = [-180.0, 180.0]
    for c in geohash:
        val = CHARS.find(c)
        if val == -1:
            continue
        for bit in range(5):
            mask = 1 << (4 - bit)
            if even:
                mid = (lng_range[0] + lng_range[1]) / 2.0
                if val & mask:
                    lng_range[0] = mid
                else:
                    lng_range[1] = mid
            else:
                mid = (lat_range[0] + lat_range[1]) / 2.0
                if val & mask:
                    lat_range[0] = mid
                else:
                    lat_range[1] = mid
            even = not even
    return {
        "lat": (lat_range[0] + lat_range[1]) / 2.0,
        "lng": (lng_range[0] + lng_range[1]) / 2.0,
    }


def main():
    if not CSV_FILE.exists():
        print(f"❌ CSV not found: {CSV_FILE}")
        sys.exit(1)

    print(f"📂 Reading CSV: {CSV_FILE}")
    with open(CSV_FILE, "r") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    print(f"   Found {len(rows):,} rows")

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # ── 0. Clear existing data to make room for fresh 2,000 sample ──────────
        print("🧹 Clearing existing database ratings and grid cells...")
        cur.execute("TRUNCATE TABLE ratings CASCADE;")
        cur.execute("TRUNCATE TABLE grid_cells CASCADE;")
        cur.execute("DELETE FROM tags WHERE is_predefined = FALSE;")
        cur.execute("UPDATE tags SET usage_count = 0;")
        conn.commit()

        # ── 0b. Randomly sample 2,000 records ──────────────────────────────────
        import random
        random.seed(42)
        rows = random.sample(rows, min(2000, len(rows)))
        print(f"🎲 Randomly sampled {len(rows):,} rows for seeding")

        # ── 1. Collect all unique tags from CSV ───────────────────────────────
        all_tags = set()
        for row in rows:
            if row["tags"]:
                for t in row["tags"].split(","):
                    t = t.strip()
                    if t:
                        all_tags.add(t)

        print(f"🏷️  Inserting {len(all_tags)} unique tags...")
        for tag_name in all_tags:
            cur.execute(
                "INSERT INTO tags (name, is_predefined, usage_count) VALUES (%s, FALSE, 0) ON CONFLICT (name) DO NOTHING",
                (tag_name,),
            )
        conn.commit()

        # Build tag name → id map
        cur.execute("SELECT id, name FROM tags")
        tag_map = {name: tid for tid, name in cur.fetchall()}

        # ── 2. Insert ratings in bulk ─────────────────────────────────────────
        print(f"📝 Inserting {len(rows):,} ratings...")
        rating_values = []
        rating_tag_links = []  # (rating_uuid, tag_name) pairs
        grid_cells_seen = {}   # cell_id → (lat, lng)

        for row in rows:
            rating_id = uuid.uuid4()
            lat = float(row["lat"])
            lng = float(row["lng"])
            cell_id = row["grid_cell_id"]
            safety_rating = int(row["safety_rating"])
            time_context = row["time_context"]
            created_at = row["created_at"]
            device_uuid = row["device_uuid"]

            rating_values.append((
                str(rating_id),
                device_uuid,
                lat,
                lng,
                cell_id,
                safety_rating,
                time_context,
                created_at,
                lng,  # for ST_Point (lng first)
                lat,  # for ST_Point
            ))

            # Track tag links
            if row["tags"]:
                for t in row["tags"].split(","):
                    t = t.strip()
                    if t and t in tag_map:
                        rating_tag_links.append((str(rating_id), tag_map[t]))

            # Track grid cells
            if cell_id not in grid_cells_seen:
                coords = decode_hash(cell_id)
                grid_cells_seen[cell_id] = (coords["lat"], coords["lng"])

        # Bulk insert ratings
        execute_values(
            cur,
            """
            INSERT INTO ratings (id, device_uuid, lat, lng, grid_cell_id, safety_rating, time_context, created_at, location)
            VALUES %s
            ON CONFLICT (id) DO NOTHING
            """,
            rating_values,
            template="(%s::uuid, %s, %s, %s, %s, %s, %s, %s::timestamptz, ST_SetSRID(ST_Point(%s, %s), 4326)::geography)",
            page_size=1000,
        )
        conn.commit()
        print(f"   ✅ Ratings inserted")

        # ── 3. Insert rating_tags links ───────────────────────────────────────
        print(f"🔗 Inserting {len(rating_tag_links):,} rating↔tag links...")
        execute_values(
            cur,
            "INSERT INTO rating_tags (rating_id, tag_id) VALUES %s ON CONFLICT DO NOTHING",
            rating_tag_links,
            template="(%s::uuid, %s)",
            page_size=1000,
        )

        # Update tag usage counts
        cur.execute("""
            UPDATE tags SET usage_count = sub.cnt
            FROM (
                SELECT tag_id, COUNT(*) as cnt
                FROM rating_tags
                GROUP BY tag_id
            ) sub
            WHERE tags.id = sub.tag_id
        """)
        conn.commit()
        print(f"   ✅ Tag links inserted and usage counts updated")

        # ── 4. Upsert grid_cells cache ────────────────────────────────────────
        print(f"🗺️  Upserting {len(grid_cells_seen):,} grid cells...")
        for cell_id, (clat, clng) in grid_cells_seen.items():
            # Compute weighted score from ratings
            cur.execute("""
                SELECT
                    COUNT(*) as total,
                    COALESCE(
                        SUM(safety_rating * EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))) /
                        NULLIF(SUM(EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))), 0),
                        0
                    ) as weighted_score
                FROM ratings
                WHERE grid_cell_id = %s
            """, (cell_id,))
            result = cur.fetchone()
            total = result[0]
            score = float(result[1]) if result[1] else 0.0

            cur.execute("""
                INSERT INTO grid_cells (cell_id, center_lat, center_lng, weighted_score, total_ratings, last_updated)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (cell_id) DO UPDATE SET
                    weighted_score = EXCLUDED.weighted_score,
                    total_ratings = EXCLUDED.total_ratings,
                    last_updated = NOW()
            """, (cell_id, clat, clng, score, total))

        conn.commit()
        print(f"   ✅ Grid cells upserted")

        # ── Summary ───────────────────────────────────────────────────────────
        cur.execute("SELECT COUNT(*) FROM ratings")
        r_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM tags")
        t_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM grid_cells")
        g_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM rating_tags")
        rt_count = cur.fetchone()[0]

        print(f"\n{'═'*50}")
        print(f"  Seed Complete!")
        print(f"{'═'*50}")
        print(f"  Ratings     : {r_count:,}")
        print(f"  Tags        : {t_count:,}")
        print(f"  Grid Cells  : {g_count:,}")
        print(f"  Rating↔Tags : {rt_count:,}")
        print(f"{'═'*50}")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
