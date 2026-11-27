# SUPPLYMIND — Supply Chain Intelligence & Command Center Platform

SUPPLYMIND is an intelligent, real-time supply chain command center with a **Hybrid RAG AI Copilot** and an **Interactive 3D Digital Twin**.

It unifies structured enterprise databases (PostgreSQL), incoming spreadsheets (Excel/CSV ingestion & cleaning pipeline), and legal supplier agreements (PDF vector indexing) into a single operational workspace.

---

## Key Features

- **Hybrid RAG AI Copilot**: Query live inventory, pending purchase orders, supplier performance, and contract SLA terms in plain, humanized conversational English with verified citations.
- **Automated Data Preprocessing**: Upload CSV or multi-sheet Excel files. The engine automatically inspects schemas, validates column integrity, cleans formatting issues, and syncs data directly into relational tables.
- **Document & SLA Intelligence**: Native PDF document chunking and vector indexing via ChromaDB to evaluate lead times, delivery penalties, and compliance clauses.
- **3D Facility Digital Twin**: WebGL-powered 3D visualization of automated warehouse bays, robotic arms, conveyor lines, AGVs, and logistics transit flow built with Three.js and React Three Fiber.
- **Operations Command Center**: Real-time telemetry monitoring stock levels, inbound shipments, sales velocity, and vendor risk tiers.

---

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript & Vite
- **Styling**: Tailwind CSS with custom bronze-taupe & glassmorphism theme
- **3D Graphics**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Animation**: Framer Motion, GSAP
- **Icons**: Lucide React

### Backend & AI
- **Framework**: FastAPI (Python 3.10+)
- **ORM & Database**: SQLAlchemy & PostgreSQL
- **RAG & Vector Search**: LangChain, ChromaDB, HuggingFace sentence-transformers
- **LLM Engine**: Groq API (High-speed inference)
- **Data Engineering**: Pandas, OpenPyXL

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- Python (v3.10+)
- PostgreSQL instance running locally or on cloud
- Groq API Key (free tier available at [console.groq.com](https://console.groq.com))

---

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Linux/Mac:
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set your `DATABASE_URL` and `GROQ_API_KEY`.

5. Start the backend API server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

API documentation will be available at `http://127.0.0.1:8000/docs`.

---

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be accessible at `http://127.0.0.1:5173`.

---

## Project Structure

```
Supplymind/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoints (inventory, sales, suppliers, chat, datasets)
│   │   ├── core/                # App configuration & settings
│   │   ├── database/            # PostgreSQL models & connection session
│   │   ├── ingestion/           # File detection & loaders
│   │   ├── preprocessing/       # Data cleaning, schema validation & inspection
│   │   ├── rag/                 # RAG chain, vector store, embeddings, retrieval
│   │   └── services/            # Business logic & database operations
│   ├── tests/                   # Backend test suites
│   ├── requirements.txt         # Python dependencies
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                 # Axios client, endpoints & TypeScript definitions
│   │   ├── components/          # Reusable UI widgets & Charts
│   │   │   ├── layout/          # Application shell & navigation
│   │   │   ├── three/           # 3D warehouse elements, robots, conveyors
│   │   │   └── ui/              # Buttons, cards, inputs, badges
│   │   ├── pages/               # Overview, Inventory, Sales, POs, Suppliers, Copilot, Datasets
│   │   └── lib/                 # Utility helpers
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

## License

This project is licensed under the MIT License.
