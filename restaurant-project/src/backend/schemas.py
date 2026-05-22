import re
import base64
from pydantic import BaseModel, Field, field_validator
from typing import Optional

# Categorías y tipos válidos
VALID_CATEGORIES = {
  "Asiática",
  "Pollo",
  "Completos",
  "Sushi",
  "Sandwiches",
  "Coreana",
  "China",
  "Pizzas",
  "Hamburguesas",
  "Peruana",
  "Mexicana",
  "Árabe",
  "Saludable",
  "Carnes",
  "Vegetariana",
  "Vegana",
}
VALID_TYPES = {
    "Restaurante", "Cafetería", "Comida Rápida", "Bar", "Pastelería",
}

# Formato válido de horario: "HH:MM - HH:MM"
SCHEDULE_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d - ([01]\d|2[0-3]):[0-5]\d$")

# Límite de tamaño para imagen base64: 2 MB en bytes originales → ~2.7 MB en base64
MAX_IMAGE_BYTES = 2 * 1024 * 1024

# Magic bytes de JPEG y PNG
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC  = b"\x89PNG"


def _validate_image_url(v: Optional[str]) -> Optional[str]:
    """Valida que image_url sea un data URL base64 de JPEG o PNG, con tamaño <= 2 MB."""
    if v is None:
        return None

    # Solo aceptar data URLs de imagen (bloquea javascript:, data:text/html, etc.)
    # Referencia: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs
    if not re.match(r"^data:image/(jpeg|png);base64,", v):
        raise ValueError("La imagen debe ser JPEG o PNG en formato data URL base64.")

    try:
        raw = base64.b64decode(v.split(",", 1)[1])
    except Exception:
        raise ValueError("La imagen no es un base64 válido.")

    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("La imagen supera el límite de 2 MB.")

    # Verificar magic bytes (no confiar solo en el MIME del data URL)
    if not (raw[:3] == JPEG_MAGIC or raw[:4] == PNG_MAGIC):
        raise ValueError("El archivo no es un JPEG o PNG válido.")

    return v


class RestaurantBase(BaseModel):
    name:      str      = Field(..., min_length=1, max_length=200)
    type:      str      = Field(..., max_length=50)
    schedule:  str      = Field(..., max_length=20)
    location:  str      = Field(..., min_length=1, max_length=200)
    category:  str      = Field(..., max_length=50)
    rate:      Optional[float] = Field(default=None, ge=0, le=5)
    visited:   bool     = False
    image_url: Optional[str] = Field(default=None)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_TYPES:
            raise ValueError(f"Tipo inválido. Opciones: {', '.join(sorted(VALID_TYPES))}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(f"Categoría inválida. Opciones: {', '.join(sorted(VALID_CATEGORIES))}")
        return v

    @field_validator("schedule")
    @classmethod
    def validate_schedule(cls, v: str) -> str:
        if not SCHEDULE_RE.match(v):
            raise ValueError("Horario debe tener formato HH:MM - HH:MM (ej: 12:00 - 23:00)")
        # Validar que apertura < cierre
        open_h, open_m   = map(int, v[:5].split(":"))
        close_h, close_m = map(int, v[-5:].split(":"))
        if open_h * 60 + open_m >= close_h * 60 + close_m:
            raise ValueError("La hora de cierre debe ser posterior a la de apertura.")
        return v

    @field_validator("image_url")
    @classmethod
    def validate_image(cls, v: Optional[str]) -> Optional[str]:
        return _validate_image_url(v)


class RestaurantCreate(RestaurantBase):
    """Schema para POST /restaurants"""
    pass


class RestaurantUpdate(BaseModel):
    """Schema para PUT /restaurants/{id} — todos los campos opcionales"""
    name:      Optional[str]   = Field(default=None, min_length=1, max_length=200)
    type:      Optional[str]   = Field(default=None, max_length=50)
    schedule:  Optional[str]   = Field(default=None, max_length=20)
    location:  Optional[str]   = Field(default=None, min_length=1, max_length=200)
    category:  Optional[str]   = Field(default=None, max_length=50)
    rate:      Optional[float] = Field(default=None, ge=0, le=5)
    visited:   Optional[bool]  = None
    image_url: Optional[str]   = Field(default=None)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_TYPES:
            raise ValueError(f"Tipo inválido. Opciones: {', '.join(sorted(VALID_TYPES))}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_CATEGORIES:
            raise ValueError(f"Categoría inválida. Opciones: {', '.join(sorted(VALID_CATEGORIES))}")
        return v

    @field_validator("schedule")
    @classmethod
    def validate_schedule(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not SCHEDULE_RE.match(v):
            raise ValueError("Horario debe tener formato HH:MM - HH:MM")
        open_h, open_m   = map(int, v[:5].split(":"))
        close_h, close_m = map(int, v[-5:].split(":"))
        if open_h * 60 + open_m >= close_h * 60 + close_m:
            raise ValueError("La hora de cierre debe ser posterior a la de apertura.")
        return v

    @field_validator("image_url")
    @classmethod
    def validate_image(cls, v: Optional[str]) -> Optional[str]:
        return _validate_image_url(v)


class RestaurantOut(RestaurantBase):
    """Schema de respuesta — incluye el id generado por la BD"""
    id: int

    class Config:
        from_attributes = True