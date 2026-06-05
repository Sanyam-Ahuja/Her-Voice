import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.utils.geohash import encode_hash, decode_hash

router = APIRouter(prefix="/api")

# Pydantic schemas for request validation
class RatingCreate(BaseModel):
    device_uuid: str
    latitude: float
    longitude: float
    safety_rating: int = Field(..., ge=1, le=5)
    tags: List[str] = []
    local_hour: Optional[int] = Field(None, ge=0, le=23)

async def recalculate_cell(cell_id: str, db: AsyncSession):
    """Recalculate cache stats for a specific cell_id"""
    sql = """
        SELECT 
            COUNT(*) as total,
            COALESCE(
                SUM(safety_rating * EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))) /
                NULLIF(SUM(EXP(-0.00770163533 * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))), 0),
                0
            ) as weighted_score
        FROM ratings
        WHERE grid_cell_id = :cell_id
    """
    res = await db.execute(text(sql), {"cell_id": cell_id})
    row = res.fetchone()
    
    if not row or row[0] == 0:
        await db.execute(text("DELETE FROM grid_cells WHERE cell_id = :cell_id"), {"cell_id": cell_id})
        return

    total = row[0]
    weighted_score = float(row[1]) if row[1] is not None else 0.0
    coords = decode_hash(cell_id)

    # Check if grid cell cache exists
    res_exists = await db.execute(text("SELECT 1 FROM grid_cells WHERE cell_id = :cell_id"), {"cell_id": cell_id})
    exists = res_exists.fetchone()

    if exists:
        update_sql = """
            UPDATE grid_cells 
            SET weighted_score = :score, total_ratings = :total, last_updated = NOW()
            WHERE cell_id = :cell_id
        """
        await db.execute(text(update_sql), {"score": weighted_score, "total": total, "cell_id": cell_id})
    else:
        insert_sql = """
            INSERT INTO grid_cells (cell_id, center_lat, center_lng, weighted_score, total_ratings, last_updated)
            VALUES (:cell_id, :lat, :lng, :score, :total, NOW())
        """
        await db.execute(text(insert_sql), {
            "cell_id": cell_id,
            "lat": coords["lat"],
            "lng": coords["lng"],
            "score": weighted_score,
            "total": total
        })

@router.post("/ratings", status_code=201)
async def create_rating(payload: RatingCreate, db: AsyncSession = Depends(get_db)):
    cell_id = encode_hash(payload.latitude, payload.longitude, 7)

    # 1. Enforce silent rate-limit: 6-day lock
    rate_limit_sql = """
        SELECT id FROM ratings 
        WHERE device_uuid = :device_uuid AND grid_cell_id = :cell_id
          AND created_at > NOW() - INTERVAL '6 days'
        LIMIT 1
    """
    res = await db.execute(text(rate_limit_sql), {
        "device_uuid": payload.device_uuid,
        "cell_id": cell_id
    })
    recent = res.fetchone()

    if recent:
        print(f"[Rate Limit] Silent discard: duplicate rating for device {payload.device_uuid} in cell {cell_id}")
        return {"success": True, "cellId": cell_id, "discarded": True}

    # 2. Insert rating record within a transaction
    rating_uuid = uuid.uuid4()
    time_ctx = str(payload.local_hour) if payload.local_hour is not None else str(datetime.now().hour)

    insert_rating_sql = """
        INSERT INTO ratings (id, device_uuid, lat, lng, grid_cell_id, safety_rating, time_context, created_at, location)
        VALUES (:id, :device_uuid, :lat, :lng, :grid_cell_id, :safety_rating, :time_context, NOW(), ST_SetSRID(ST_Point(:lng, :lat), 4326)::geography)
        RETURNING id
    """
    res_rating = await db.execute(text(insert_rating_sql), {
        "id": rating_uuid,
        "device_uuid": payload.device_uuid,
        "lat": payload.latitude,
        "lng": payload.longitude,
        "grid_cell_id": cell_id,
        "safety_rating": payload.safety_rating,
        "time_context": time_ctx
    })
    rating_db_id = res_rating.scalar()

    # 3. Handle tags association
    for tag_name in payload.tags:
        # Check if tag exists
        res_tag = await db.execute(text("SELECT id FROM tags WHERE name = :name"), {"name": tag_name})
        tag_row = res_tag.fetchone()
        
        if tag_row:
            tag_id = tag_row[0]
            await db.execute(text("UPDATE tags SET usage_count = usage_count + 1 WHERE id = :id"), {"id": tag_id})
        else:
            res_new_tag = await db.execute(
                text("INSERT INTO tags (name, is_predefined, usage_count) VALUES (:name, FALSE, 1) RETURNING id"),
                {"name": tag_name}
            )
            tag_id = res_new_tag.scalar()

        # Link rating and tag
        await db.execute(
            text("INSERT INTO rating_tags (rating_id, tag_id) VALUES (:rating_id, :tag_id) ON CONFLICT DO NOTHING"),
            {"rating_id": rating_db_id, "tag_id": tag_id}
        )

    # 4. Recalculate grid cells cache
    await recalculate_cell(cell_id, db)

    return {"success": True, "cellId": cell_id, "discarded": False}

@router.get("/tags")
async def get_tags(db: AsyncSession = Depends(get_db)):
    predefined_res = await db.execute(text("SELECT id, name FROM tags WHERE is_predefined = TRUE"))
    predefined = [{"id": r[0], "name": r[1]} for r in predefined_res.fetchall()]

    custom_res = await db.execute(text("""
        SELECT id, name, usage_count FROM tags 
        WHERE is_predefined = FALSE 
        ORDER BY usage_count DESC 
        LIMIT 10
    """))
    custom = [{"id": r[0], "name": r[1], "usage_count": r[2]} for r in custom_res.fetchall()]

    return {
        "predefined": predefined,
        "popular_custom": custom
    }

@router.get("/heatmap")
async def get_heatmap(
    swLat: Optional[float] = Query(None),
    swLng: Optional[float] = Query(None),
    neLat: Optional[float] = Query(None),
    neLng: Optional[float] = Query(None),
    hour: str = Query("live"),
    db: AsyncSession = Depends(get_db)
):
    try:
        if hour == "live" or not hour:
            target_hour = datetime.now().hour
        else:
            target_hour = int(hour)
    except ValueError:
        target_hour = datetime.now().hour

    hr_expr = "(CASE WHEN r.time_context ~ '^[0-9]+$' THEN CAST(r.time_context AS INTEGER) WHEN r.time_context = 'day' THEN 12 ELSE 0 END)"

    sql = f"""
        SELECT 
            r.grid_cell_id,
            c.center_lat,
            c.center_lng,
            COUNT(r.id) as total_ratings,
            COALESCE(
                SUM(
                    r.safety_rating * 
                    EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
                    EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
                ) / 
                NULLIF(
                    SUM(
                        EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
                        EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
                    ), 
                    0
                ),
                0
            ) as score,
            SUM(
                EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
                EXP(-POWER(LEAST(ABS({hr_expr} - :hour), 24 - ABS({hr_expr} - :hour)), 2) / 4.5)
            ) as total_weight
        FROM ratings as r
        JOIN grid_cells as c ON r.grid_cell_id = c.cell_id
    """

    conditions = []
    params = {"hour": target_hour}

    if swLat is not None and swLng is not None and neLat is not None and neLng is not None:
        conditions.append("c.center_lat >= :swLat AND c.center_lat <= :neLat")
        conditions.append("c.center_lng >= :swLng AND c.center_lng <= :neLng")
        params.update({"swLat": swLat, "neLat": neLat, "swLng": swLng, "neLng": neLng})

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " GROUP BY r.grid_cell_id, c.center_lat, c.center_lng"

    res = await db.execute(text(sql), params)
    rows = res.fetchall()

    formatted = []
    for r in rows:
        total_weight = float(r[5]) if r[5] is not None else 0.0
        # Enforce threshold filter
        if total_weight < 0.05:
            continue

        score = float(r[4])
        formatted.append({
            "cell_id": r[0],
            "center": {
                "lat": float(r[1]),
                "lng": float(r[2])
            },
            "score": round(score, 2),
            "total_ratings": int(r[3]),
            "weight": round(total_weight, 3)
        })

    return {"cells": formatted}
