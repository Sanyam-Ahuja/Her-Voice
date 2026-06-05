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
