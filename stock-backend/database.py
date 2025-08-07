from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"  # For SQLite. For PostgreSQL: 'postgresql://user:pass@localhost/db'
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- Add this function ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()