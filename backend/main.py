"""Budget App — FastAPI entry point."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import init_db, SessionLocal
from .seed import seed_categories
from .routers import auth, accounts, categories, rules, transactions, import_csv, bank_profiles, dashboard, trends, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB and seed data on startup."""
    init_db()
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Budget",
    description="Personal finance tracking app",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(rules.router)
app.include_router(transactions.router)
app.include_router(import_csv.router)
app.include_router(bank_profiles.router)
app.include_router(dashboard.router)
app.include_router(trends.router)
app.include_router(export.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Budget"}


# Serve frontend static files in production
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
