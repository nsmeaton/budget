# Budget — Personal Finance Tracking App

A self-hosted personal finance tracker that helps you understand where your money goes, categorise spending by necessity, and answer: *"How much do I actually need each month?"*

## Features

- **CSV Import** — Upload bank statements from any bank, with flexible column mapping
- **Smart Categorisation** — Rule-based auto-categorisation with manual override
- **Five-Tier Classification** — Essential, Optional, Discretionary, Savings, Transfer
- **Income Tracking** — Salary, Bonus, RSU, and Investments tracked separately
- **Transaction Splitting** — Split single bank entries into multiple categorised items
- **Dashboard** — Annual overview with charts and monthly breakdown
- **Trends** — Category and tier analysis over time
- **Multi-Account** — Track multiple bank accounts with unified view
- **Data Export** — Full JSON export for backup
- **Security** — Auth, HTTPS, encrypted file storage

## Tech Stack

- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy / SQLite
- **Frontend:** React 18 / Vite / Shadcn/ui / Tailwind CSS / Recharts / TanStack Table
- **Target:** Raspberry Pi 4 (8GB RAM) — self-hosted on local network

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- OpenSSL (for HTTPS cert generation)

### 1. Clone and install backend

```bash
cd budget
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Install and build frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Generate HTTPS certificate (optional but recommended)

```bash
./scripts/generate_cert.sh
```

### 4. Start the app

```bash
./scripts/start.sh
```

The app will be available at `https://<your-pi-ip>:8443` (or `http://` if no cert).

### 5. First-time setup

On first visit, you'll be prompted to create a username and password.

## Raspberry Pi Deployment

### Install dependencies on Pi

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nodejs npm openssl
```

### Run as a service (systemd)

Create `/etc/systemd/system/budget.service`:

```ini
[Unit]
Description=Budget Finance App
After=network.target

[Service]
Type=simple
User=nsmeaton
WorkingDirectory=/home/nsmeaton/budget
ExecStart=/home/nsmeaton/budget/scripts/start.sh
Restart=always
Environment=BUDGET_SECRET_KEY=your-secret-key-here
Environment=BUDGET_DATA_DIR=/home/nsmeaton/budget/data

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl enable budget
sudo systemctl start budget
```

## Project Structure

```
budget/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # DB config and session
│   ├── models.py            # SQLAlchemy ORM models
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── auth.py              # JWT authentication
│   ├── seed.py              # Default category seeder
│   ├── requirements.txt
│   └── routers/
│       ├── auth.py          # Login/setup endpoints
│       ├── accounts.py      # Account CRUD
│       ├── categories.py    # Category/group CRUD
│       ├── rules.py         # Auto-categorisation rules
│       ├── transactions.py  # Transaction CRUD, split, bulk
│       ├── import_csv.py    # CSV upload and processing
│       ├── bank_profiles.py # Saved column mappings
│       ├── dashboard.py     # KPIs and monthly breakdown
│       ├── trends.py        # Spending trends and analytics
│       └── export.py        # Full data export
├── frontend/                # React app (Vite + Shadcn/ui)
├── scripts/
│   ├── generate_cert.sh     # Self-signed HTTPS cert
│   └── start.sh             # Start the server
├── certs/                   # Generated certificates (gitignored)
├── data/                    # SQLite database (gitignored)
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUDGET_SECRET_KEY` | Random | JWT signing key (set in production) |
| `BUDGET_DATA_DIR` | `backend/data/` | Database file location |
| `BUDGET_ENCRYPTION_KEY` | Auto-generated | Fernet key for CSV encryption |

## API Documentation

With the server running, visit `/docs` for the interactive Swagger UI.

## Backup

Use the Export page or hit `GET /api/export/full` to download a complete JSON backup of all your data.
