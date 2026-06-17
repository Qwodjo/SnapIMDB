# SnapIMDB

AI-Driven Image-to-Item Master Data Tool — GDSS-Maverick Hackathon submission.

SnapIMDB extracts all 13 Item Master Database (IMDB) attributes from product
images using vision AI, fuses evidence across multiple angles of the same
product, self-corrects via a critic pass, and exports a confidence-scored
`predictions.xlsx` ready for database import.

---

## Demo video

[https://drive.google.com/file/d/1ShJWH42I8-7SDPmL6lYucoVzqoCmb5yh/view?usp=drive_link]

## Live link (if hosted)

[https://snap-imdb.vercel.app/]

---

## Architecture

```
Product photos (1–8 angles)
        ↓
Group by filename prefix
        ↓
Parallel vision extraction (per image)
        ↓
Confidence-weighted fusion (best value per field across images)
        ↓
Critic pass (second AI call — consistency review)
        ↓
Normalization (barcode, weight, country, packaging cleanup)
        ↓
Preview table (confidence-colored, editable)
        ↓
Export predictions.xlsx
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Vision AI | Gemini 2.0 Flash via REST API |
| Validation | Pydantic |
| Export | openpyxl |
| Evaluation | Barcode-based matching against any reference Excel/CSV |

---

## Prerequisites

- Python 3.12+
- Node.js 18+
- A Gemini API key — free at [aistudio.google.com](https://aistudio.google.com)
  (click your profile → "Get API key" → "Create API key")

---

## Setup — backend

```bash
git clone https://github.com/YOUR_USERNAME/SnapIMDB.git
cd SnapIMDB

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

cd snapimdb-backend
pip install -r requirements.txt
```

Create a `.env` file inside `snapimdb-backend`:

```env
GEMINI_API_KEY=[Pasted in assignment submission text box per GitHub restrictions]
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend is now running at `http://localhost:8000`.
API docs: `http://localhost:8000/docs`

---

## Setup — frontend

In a new terminal:

```bash
cd SnapIMDB/snapimdb-frontend
npm install
npm run dev
```

Frontend is now running at `http://localhost:5173`.

---

## How to use it

1. Open `http://localhost:5173`
2. On the **Upload & Extract** tab, drop product images (or use the live
   camera). Images with the same filename prefix (e.g. `S221234199_*`) are
   grouped and fused as one product.
3. Click **Extract** — the pipeline runs vision extraction, fusion, critic
   review, and normalization for each product group.
4. Review the table — colored cells indicate confidence (green ≥75%,
   yellow 50–74%, red <50%). Click any cell to edit before export.
5. Click **Export predictions.xlsx** to download the result.
6. On the **Eval Dashboard / Catalog Audit** tab, upload an existing
   master data file (e.g. the hackathon ground truth, or any business's
   existing product catalog). The system matches by barcode and reports
   per-column accuracy — works correctly regardless of row order or count
   mismatches between predictions and the reference file.

---

## API keys provided for reproduction

A working Gemini API key for reproduction/testing purposes is included
separately in the submission notes to judges (not committed to this
public repository for security reasons). Judges should be able to drop
it directly into `.env` and run the steps above with no further setup.

---

## Project structure

```
SnapIMDB/
├── snapimdb-backend/
│   ├── app/
│   │   ├── main.py            FastAPI routes
│   │   ├── schemas.py         Pydantic IMDBRecord (13 fields + confidence)
│   │   ├── extraction.py      Vision AI calls (Gemini REST API)
│   │   ├── fusion.py          Multi-image confidence-weighted merge
│   │   ├── critic.py          Second-pass consistency review
│   │   ├── normalization.py   Packaging/country/weight/barcode cleanup
│   │   ├── duplicates.py      Barcode + brand + name duplicate detection
│   │   └── export.py          predictions.xlsx generation with color coding
│   └── requirements.txt
└── snapimdb-frontend/
    └── src/
        ├── App.jsx
        └── components/
            ├── UploadZone.jsx       Upload + live camera capture
            ├── ResultsTable.jsx     Confidence-colored editable table
            └── EvalDashboard.jsx    Barcode-based accuracy evaluation
```

---

## Known limitations

- Free-tier vision API rate limits may slow large batch extraction
  (45 products × up to 8 images each). For best results, extract in
  smaller batches if rate-limited.
- Evaluation requires the reference file to contain a `BARCODE` column
  for matching; products without a barcode in either file are reported
  as unmatched rather than scored.
