"""
HerVoice - API Routes
app/routes.py

Endpoints:
  POST /api/ratings   – Submit a safety rating
  GET  /api/heatmap   – Live analytical heatmap with AI gap-filling
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.geohash import encode_hash, decode_hash, neighbors
from app.services.ml_service import safety_predictor
from app.config import API_KEY

async def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

router = APIRouter(prefix="/api", dependencies=[Depends(verify_api_key)])


# ══════════════════════════════════════════════════════════════════════════════
# Pydantic Schemas
# ══════════════════════════════════════════════════════════════════════════════

class RatingCreate(BaseModel):
    device_uuid:   str
    latitude:      float
    longitude:     float
    safety_rating: int           = Field(..., ge=1, le=5)
    tags:          List[str]     = []
    local_hour:    Optional[int] = Field(None, ge=0, le=23)


# ══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ══════════════════════════════════════════════════════════════════════════════

async def recalculate_cell(cell_id: str, db: AsyncSession) -> None:
    """Recompute and upsert the grid_cells cache row for *cell_id*."""
    sql = """
        SELECT
            COUNT(*) AS total,
            COALESCE(
                SUM(safety_rating * EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))) /
                NULLIF(SUM(EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))), 0),
                0
            ) AS weighted_score
        FROM ratings
        WHERE grid_cell_id = :cell_id
    """
    res = await db.execute(text(sql), {"cell_id": cell_id})
    row = res.fetchone()

    if not row or row[0] == 0:
        await db.execute(text("DELETE FROM grid_cells WHERE cell_id = :cell_id"), {"cell_id": cell_id})
        return

    total          = row[0]
    weighted_score = float(row[1]) if row[1] is not None else 0.0
    coords         = decode_hash(cell_id)

    res_exists = await db.execute(
        text("SELECT 1 FROM grid_cells WHERE cell_id = :cell_id"), {"cell_id": cell_id}
    )
    exists = res_exists.fetchone()

    if exists:
        await db.execute(
            text("""
                UPDATE grid_cells
                SET weighted_score = :score, total_ratings = :total, last_updated = NOW()
                WHERE cell_id = :cell_id
            """),
            {"score": weighted_score, "total": total, "cell_id": cell_id},
        )
    else:
        await db.execute(
            text("""
                INSERT INTO grid_cells (cell_id, center_lat, center_lng, weighted_score, total_ratings, last_updated)
                VALUES (:cell_id, :lat, :lng, :score, :total, NOW())
            """),
            {
                "cell_id": cell_id,
                "lat":     coords["lat"],
                "lng":     coords["lng"],
                "score":   weighted_score,
                "total":   total,
            },
        )


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/ratings
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/ratings", status_code=201)
async def create_rating(payload: RatingCreate, db: AsyncSession = Depends(get_db)):
    cell_id = encode_hash(payload.latitude, payload.longitude, 7)

    # Silent rate-limit: one rating per cell per device per 6 days
    rate_limit_sql = """
        SELECT id FROM ratings
        WHERE device_uuid = :device_uuid AND grid_cell_id = :cell_id
          AND created_at > NOW() - INTERVAL '6 days'
        LIMIT 1
    """
    res = await db.execute(text(rate_limit_sql), {"device_uuid": payload.device_uuid, "cell_id": cell_id})
    if res.fetchone():
        return {"success": True, "cellId": cell_id, "discarded": True}

    rating_uuid = uuid.uuid4()
    time_ctx    = str(payload.local_hour) if payload.local_hour is not None else str(datetime.now().hour)

    res_rating = await db.execute(
        text("""
            INSERT INTO ratings (id, device_uuid, lat, lng, grid_cell_id, safety_rating, time_context, created_at, location)
            VALUES (:id, :device_uuid, :lat, :lng, :grid_cell_id, :safety_rating, :time_context, NOW(),
                    ST_SetSRID(ST_Point(:lng, :lat), 4326)::geography)
            RETURNING id
        """),
        {
            "id":            rating_uuid,
            "device_uuid":   payload.device_uuid,
            "lat":           payload.latitude,
            "lng":           payload.longitude,
            "grid_cell_id":  cell_id,
            "safety_rating": payload.safety_rating,
            "time_context":  time_ctx,
        },
    )
    rating_db_id = res_rating.scalar()

    for tag_name in payload.tags:
        res_tag = await db.execute(text("SELECT id FROM tags WHERE name = :name"), {"name": tag_name})
        tag_row = res_tag.fetchone()

        if tag_row:
            tag_id = tag_row[0]
            await db.execute(text("UPDATE tags SET usage_count = usage_count + 1 WHERE id = :id"), {"id": tag_id})
        else:
            res_new = await db.execute(
                text("INSERT INTO tags (name, is_predefined, usage_count) VALUES (:name, FALSE, 1) RETURNING id"),
                {"name": tag_name},
            )
            tag_id = res_new.scalar()

        await db.execute(
            text("INSERT INTO rating_tags (rating_id, tag_id) VALUES (:rating_id, :tag_id) ON CONFLICT DO NOTHING"),
            {"rating_id": rating_db_id, "tag_id": tag_id},
        )

    await recalculate_cell(cell_id, db)
    return {"success": True, "cellId": cell_id, "discarded": False}


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/tags  (commented out — not consumed by mobile app yet)
# ══════════════════════════════════════════════════════════════════════════════

# @router.get("/tags")
# async def get_tags(db: AsyncSession = Depends(get_db)):
#     predefined_res = await db.execute(text("SELECT id, name FROM tags WHERE is_predefined = TRUE"))
#     predefined = [{"id": r[0], "name": r[1]} for r in predefined_res.fetchall()]
# 
#     custom_res = await db.execute(text("""
#         SELECT id, name, usage_count FROM tags
#         WHERE is_predefined = FALSE
#         ORDER BY usage_count DESC
#         LIMIT 10
#     """))
#     custom = [{"id": r[0], "name": r[1], "usage_count": r[2]} for r in custom_res.fetchall()]
# 
#     return {"predefined": predefined, "popular_custom": custom}


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/heatmap  (analytical heatmap + AI gap-filling)
# ══════════════════════════════════════════════════════════════════════════════

MAX_PREDICTED_CELLS = 50  # Cap on AI-predicted gap cells per request

@router.get("/heatmap")
async def get_heatmap(
    swLat: Optional[float] = Query(None),
    swLng: Optional[float] = Query(None),
    neLat: Optional[float] = Query(None),
    neLng: Optional[float] = Query(None),
    hour:  str             = Query("live"),
    db:    AsyncSession    = Depends(get_db),
):
    try:
        target_hour = datetime.now().hour if hour in ("live", "") else int(hour)
    except ValueError:
        target_hour = datetime.now().hour

    hr_expr = (
        "(CASE WHEN r.time_context ~ '^[0-9]+$' THEN CAST(r.time_context AS INTEGER) "
        "WHEN r.time_context = 'day' THEN 12 ELSE 0 END)"
    )

    sql = f"""
        SELECT
            r.grid_cell_id,
            c.center_lat,
            c.center_lng,
            COUNT(r.id) AS total_ratings,
            COALESCE(
                SUM(
                    r.safety_rating *
                    EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) *
                    EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
                ) /
                NULLIF(SUM(
                    EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) *
                    EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
                ), 0),
                0
            ) AS score,
            SUM(
                EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) *
                EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
            ) AS total_weight
        FROM ratings AS r
        JOIN grid_cells AS c ON r.grid_cell_id = c.cell_id
    """

    conditions: list[str] = []
    params = {"hour": target_hour}

    if all(v is not None for v in [swLat, swLng, neLat, neLng]):
        conditions.append("c.center_lat BETWEEN :swLat AND :neLat")
        conditions.append("c.center_lng BETWEEN :swLng AND :neLng")
        params.update({"swLat": swLat, "neLat": neLat, "swLng": swLng, "neLng": neLng})

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " GROUP BY r.grid_cell_id, c.center_lat, c.center_lng"
    sql += " ORDER BY total_weight DESC LIMIT 250"

    res  = await db.execute(text(sql), params)
    rows = res.fetchall()

    # ── Build crowd-sourced cells ─────────────────────────────────────────────
    crowd_cells = []
    crowd_cell_ids = set()

    for r in rows:
        total_weight = float(r[5]) if r[5] is not None else 0.0
        if total_weight < 0.05:
            continue
        cell_id = r[0]
        crowd_cell_ids.add(cell_id)
        crowd_cells.append({
            "cell_id": cell_id,
            "center":  {"lat": float(r[1]), "lng": float(r[2])},
            "score":   round(float(r[4]), 2),
            "total_ratings": int(r[3]),
            "weight":  round(total_weight, 3),
            "predicted": False,
        })

    # ── AI gap-filling: predict for empty neighbor cells ──────────────────────
    predicted_cells = []

    if safety_predictor.is_ready and crowd_cells:
        # Collect all unique neighbor cell_ids that are NOT in crowd data
        gap_cell_ids = set()
        for cell in crowd_cells:
            for neighbor_id in neighbors(cell["cell_id"]):
                if neighbor_id not in crowd_cell_ids:
                    gap_cell_ids.add(neighbor_id)

        # Cap at MAX_PREDICTED_CELLS
        gap_list = list(gap_cell_ids)[:MAX_PREDICTED_CELLS]

        if gap_list:
            # Prepare batch prediction input
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            batch_input = []
            gap_centers = []

            for gid in gap_list:
                center = decode_hash(gid)
                gap_centers.append(center)
                batch_input.append({
                    "latitude":     center["lat"],
                    "longitude":    center["lng"],
                    "tags":         "",
                    "grid_cell_id": gid,
                    "created_at":   now_str,
                    "time_context": target_hour,
                })

            # Batch predict
            ai_scores = safety_predictor.predict_batch(batch_input)

            for gid, center, score in zip(gap_list, gap_centers, ai_scores):
                predicted_cells.append({
                    "cell_id": gid,
                    "center":  {"lat": round(center["lat"], 6), "lng": round(center["lng"], 6)},
                    "score":   round(score, 2),
                    "total_ratings": 0,
                    "weight":  0.5,  # Fixed moderate weight for opacity scaling
                    "predicted": True,
                })

    print(f"🔥 Heatmap request served: {len(crowd_cells)} crowd cells, {len(predicted_cells)} AI-predicted gap cells.")
    return {"cells": crowd_cells + predicted_cells}
