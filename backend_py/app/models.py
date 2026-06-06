import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import UserDefinedType
from app.database import Base

class Geography(UserDefinedType):
    def get_col_spec(self, **kw):
        return "GEOGRAPHY(Point, 4326)"

class Tag(Base):
    __tablename__ = 'tags'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    is_predefined = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)

class Rating(Base):
    __tablename__ = 'ratings'
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Using raw String/UUID type handling to be compatible
    device_uuid = Column(String(64), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    grid_cell_id = Column(String(20), nullable=False)
    safety_rating = Column(Integer, nullable=False)
    time_context = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    location = Column(Geography)

class RatingTag(Base):
    __tablename__ = 'rating_tags'
    rating_id = Column(PG_UUID(as_uuid=True), ForeignKey('ratings.id', ondelete='CASCADE'), primary_key=True)
    tag_id = Column(Integer, ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True)

class GridCell(Base):
    __tablename__ = 'grid_cells'
    cell_id = Column(String(20), primary_key=True)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    weighted_score = Column(Float, default=0.0)
    total_ratings = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)
