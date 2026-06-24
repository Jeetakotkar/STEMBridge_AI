import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# ── Backwards-compatible import for declarative_base ─────────────────────────
try:
    from sqlalchemy.orm import declarative_base          # SQLAlchemy 1.4+
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base  # SQLAlchemy < 1.4

load_dotenv()

# ── Never hardcode credentials — always use .env ──────────────────────────────
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:Jeet2007!@localhost:3306/stembridge_ai"
)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_pre_ping=True,   # auto-reconnect if DB drops the connection
    pool_recycle=3600,    # recycle connections every hour to avoid stale handles
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
