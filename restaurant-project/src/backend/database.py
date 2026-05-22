from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite — no requiere instalación ni configuración adicional
# El archivo restaurants.db se crea automáticamente en src/backend/
# Referencia: https://docs.sqlalchemy.org/en/20/dialects/sqlite.html
DATABASE_URL = "sqlite:///./restaurants.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # Requerido solo para SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency que provee una sesión de BD por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()