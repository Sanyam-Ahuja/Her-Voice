import contextlib
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import router
from app.config import CORS_ORIGINS
from app.services.ml_service import safety_predictor

logger = logging.getLogger(__name__)

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure tables exist (will run create_all on metadata)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Load ML model artifacts into memory (graceful if missing)
    if safety_predictor.load():
        logger.info("ML SafetyPredictor loaded successfully")
    else:
        logger.warning("ML SafetyPredictor not available — heatmap will show crowd data only")
    yield

app = FastAPI(
    title="HerVoice API",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS Middleware
is_wildcard = "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else CORS_ORIGINS,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(router)

@app.get("/")
def read_root():
    return {"message": "HerVoice Python API is online"}
