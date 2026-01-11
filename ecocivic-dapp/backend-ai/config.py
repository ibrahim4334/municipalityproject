import os

from dotenv import load_dotenv

load_dotenv()

# ==============================
# APP CONFIG
# ==============================
APP_NAME = "EcoCivic AI Backend"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# ==============================
# API CONFIG
# ==============================
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))

# ==============================
# DATABASE CONFIG
# ==============================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:password@localhost:3306/ecocivic?charset=utf8mb4",
)

# ==============================
# AI / ML CONFIG
# ==============================
AI_MODEL_PROVIDER = os.getenv("AI_MODEL_PROVIDER", "openai")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "gpt-4o-mini")
AI_API_KEY = os.getenv("AI_API_KEY")

# Image verification confidence threshold
AI_CONFIDENCE_THRESHOLD = float(os.getenv("AI_CONFIDENCE_THRESHOLD", 0.85))

# ==============================
# BLOCKCHAIN CONFIG
# ==============================
BLOCKCHAIN_RPC_URL = os.getenv(
    "BLOCKCHAIN_RPC_URL",
    "https://rpc-mumbai.maticvigil.com",
)

BELT_TOKEN_ADDRESS = os.getenv("BELT_TOKEN_ADDRESS")
RECYCLING_REWARDS_ADDRESS = os.getenv("RECYCLING_REWARDS_ADDRESS")

BACKEND_WALLET_PRIVATE_KEY = os.getenv("BACKEND_WALLET_PRIVATE_KEY")

# ==============================
# QR TOKEN CONFIG
# ==============================
QR_TOKEN_EXPIRY_HOURS = int(os.getenv("QR_TOKEN_EXPIRY_HOURS", 3))
QR_SECRET_KEY = os.getenv("QR_SECRET_KEY")

if not QR_SECRET_KEY:
    raise RuntimeError("QR_SECRET_KEY environment variable is required security critical configuration.")

# ==============================
# SECURITY
# ==============================
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", 60))

# CORS Configuration
API_CORS_ORIGINS = os.getenv("API_CORS_ORIGINS", "*")  # Comma-separated list in production

# Üretim ortamında zayıf default secret ile ayağa kalkmasını engelle
if not DEBUG and JWT_SECRET_KEY == "super-secret-key":
    raise RuntimeError(
        "In production (DEBUG=false), you MUST set a strong JWT_SECRET_KEY in the environment."
    )
