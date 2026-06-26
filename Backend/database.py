import os, ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# ── Backwards-compatible import for declarative_base ─────────────────────────
try:
    from sqlalchemy.orm import declarative_base       # SQLAlchemy 1.4+
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base

load_dotenv()

# ── Database URL must be set in environment variables ─────────────────────────
# On Render: Settings → Environment → Add Environment Variable
#   Key:   DATABASE_URL
#   Value: mysql+pymysql://avnadmin:PASSWORD@HOST:PORT/defaultdb
#
# How to get this from Aiven:
#   1. Open your Aiven MySQL service
#   2. Click "Connection information"
#   3. Copy the "Service URI"  (it starts with  mysql://...)
#   4. Change  mysql://  →  mysql+pymysql://   (just add +pymysql)
#   5. Paste that as your DATABASE_URL on Render
# ─────────────────────────────────────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. "
        "Add it to your .env (local) or Render environment variables (production)."
    )

# ── SSL setup for Aiven (and any cloud MySQL provider) ───────────────────────
# Aiven requires SSL on all connections. On Render (Ubuntu/Linux), the system
# CA bundle can verify Aiven's certificates without needing a separate cert file.
_ssl_ctx = ssl.create_default_context(
    cafile="/etc/ssl/certs/ca-certificates.crt"   # Render's system CA bundle
)
# Locally (Windows/Mac) the system bundle path is different, so fall back
# gracefully: if the file doesn't exist, use Python's built-in CA bundle.
if not os.path.exists("/etc/ssl/certs/ca-certificates.crt"):
    _ssl_ctx = ssl.create_default_context()       # uses Python's bundled CAs

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"ssl": _ssl_ctx},   # enforces SSL — required by Aiven
    pool_pre_ping=True,               # drops stale connections automatically
    pool_recycle=1800,                # recycle every 30 min (Aiven times out idle ones)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()