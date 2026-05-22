from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional

import models
import schemas
import base64, os
from database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Restaurants API")

# ─── Límite de tamaño de request (~3 MB cubre imagen base64 + JSON) ───────────
# Protege contra payloads gigantes que saturen memoria 
# Referencia: https://www.starlette.io/middleware/
MAX_REQUEST_BYTES = 3_500_000  # 3.5 MB

# ─── Función aux para manejar imágenes ───────────
def img(filename: str) -> str | None:
    """Lee una imagen de assets/ y la convierte a base64 data URL."""
    path = os.path.join(os.path.dirname(__file__), "assets", filename)
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext  = filename.rsplit(".", 1)[-1].lower()
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else "image/png"
    return f"data:{mime};base64,{data}"

@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_REQUEST_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Payload demasiado grande (máx. 3.5 MB)."})
    return await call_next(request)

# ─── CORS — solo el origen del frontend ───────────────────────────────────────
# Referencia: https://fastapi.tiangolo.com/tutorial/cors/
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# ─── Seed ─────────────────────────────────────────────────────────────────────
SEED = [
    {"name": "Central",             "type": "Restaurante",   "schedule": "12:00 - 23:00", "location": "Lima, Perú",               "category": "Peruana",   "rate": 5.0,  "visited": True,  "image_url": None},
    {"name": "Osteria Francescana", "type": "Restaurante",   "schedule": "19:00 - 23:00", "location": "Módena, Italia",           "category": "Pizzas",  "rate": 4.3,  "visited": False, "image_url": img("mactin-food-2930764_1920.jpg")},
    {"name": "Pujol",               "type": "Restaurante",   "schedule": "13:00 - 22:00", "location": "Ciudad de México, México", "category": "Mexicana",  "rate": 4.5,  "visited": True,  "image_url": None},
    {"name": "Sushi Saito",         "type": "Restaurante",   "schedule": "12:00 - 14:00", "location": "Tokio, Japón",             "category": "Sushi",  "rate": 4.9,  "visited": False, "image_url": img("mekan_4-sushi-8113165_1920.jpg")},
    {"name": "Noma",                "type": "Restaurante",   "schedule": "18:00 - 22:00", "location": "Copenhague, Dinamarca",    "category": "Vegana",    "rate": None, "visited": False, "image_url": None},
    {"name": "Blue Bottle Coffee",  "type": "Cafetería",     "schedule": "07:00 - 18:00", "location": "San Francisco, EE.UU.",    "category": "Hamburguesas", "rate": 3.8,  "visited": True,  "image_url": img("jeandelafountain0-burger-2117465_1920.jpg")},
    {"name": "Maison Ladurée",      "type": "Pastelería",    "schedule": "08:30 - 19:30", "location": "París, Francia",           "category": "Saludable",  "rate": 2.9,  "visited": False, "image_url": None},
    {"name": "Gwangjang Market",    "type": "Comida Rápida", "schedule": "09:00 - 23:00", "location": "Seúl, Corea del Sur",      "category": "Coreana",   "rate": None, "visited": False, "image_url": None},
]


@app.on_event("startup")
def seed_db():
    db = next(get_db())
    if db.query(models.Restaurant).count() == 0:
        for item in SEED:
            db.add(models.Restaurant(**item))
        db.commit()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/restaurants", response_model=list[schemas.RestaurantOut])
def list_restaurants(
    name:     Optional[str]  = Query(default=None, max_length=120),
    category: Optional[str]  = Query(default=None, max_length=60),
    location: Optional[str]  = Query(default=None, max_length=120),
    visited:  Optional[bool] = Query(default=None),
    type:     Optional[str]  = Query(default=None, max_length=60),
    db: Session = Depends(get_db),
):
    query = db.query(models.Restaurant)
    # SQLAlchemy parametriza automáticamente — no hay SQL injection
    if name:     query = query.filter(models.Restaurant.name.ilike(f"%{name}%"))
    if category: query = query.filter(models.Restaurant.category == category)
    if location: query = query.filter(models.Restaurant.location.ilike(f"%{location}%"))
    if type:     query = query.filter(models.Restaurant.type == type)
    if visited is not None:
        query = query.filter(models.Restaurant.visited == visited)
    return query.all()


@app.post("/restaurants", response_model=schemas.RestaurantOut, status_code=201)
def create_restaurant(payload: schemas.RestaurantCreate, db: Session = Depends(get_db)):
    restaurant = models.Restaurant(**payload.model_dump())
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@app.put("/restaurants/{restaurant_id}", response_model=schemas.RestaurantOut)
def update_restaurant(
    restaurant_id: int,
    payload: schemas.RestaurantUpdate,
    db: Session = Depends(get_db),
):
    restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(restaurant, field, value)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@app.delete("/restaurants/{restaurant_id}", status_code=204)
def delete_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    restaurant = db.query(models.Restaurant).filter(models.Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado")
    db.delete(restaurant)
    db.commit()