"""
OTD Risk Dashboard – Backend API (FastAPI)
MVC Pattern: This file is the Controller layer.
  Model  → data.py  (reads & transforms Excel data)
  View   → React frontend (frontend/src)
  Controller → This file (routes requests, calls model, returns JSON)
"""
from fastapi import FastAPI, Query, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import data

app = FastAPI(title="OTD Risk Dashboard API", version="1.0.0")

# Allow React dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/debug/columns")
def debug_columns():
    """Return all column names present in the loaded Excel sheet."""
    import data as _data
    df = _data.get_df()
    return {"columns": df.columns.tolist()}


@app.get("/api/debug/dates")
def debug_dates():
    """Return date-parsing diagnostics — shows total rows, NaT count, and month distribution."""
    df = data.get_df()
    nat_count = int(df["Dock Month"].isna().sum())
    month_counts = (
        df.dropna(subset=["Month"])
        .groupby(["Month_Sort", "Month"])
        .size()
        .reset_index(name="count")
        .sort_values("Month_Sort")
        .to_dict(orient="records")
    )
    return {
        "total_rows": len(df),
        "unparsed_dock_month_rows": nat_count,
        "months": month_counts,
    }


@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
    """Accept an Excel upload, reload the in-memory DataFrame, return row count."""
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_data(contents)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_df())}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.get("/api/filters")
def get_filters():
    """Return unique values for each filter dropdown."""
    return data.get_filter_options()


@app.get("/api/pivot1")
def get_pivot1(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return PO Line count pivot table: Stages × On-time/Delay status."""
    return data.get_pivot1_data(stages, ontime_delay, delay_category, months)


@app.get("/api/pivot2")
def get_pivot2(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return Pivot 2: % share of each stage per month (stage count / month total)."""
    return data.get_pivot2_data(stages, ontime_delay, delay_category, months)


@app.get("/api/pivot4")
def get_pivot4(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return OTD Projection pivot: Ontime / Delay / Past Due / Total / % OTD rows × months."""
    return data.get_pivot4_data(stages, ontime_delay, delay_category, months)


@app.get("/api/chart2")
def get_chart2(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return month-wise, stage-wise % share for stacked bar chart (mirrors Pivot2)."""
    return data.get_chart2_data(stages, ontime_delay, delay_category, months)


@app.get("/api/pivot5")
def get_pivot5(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return Pivot 5: Delay Line / Docking Lines / Total Past Due Lines × months."""
    return data.get_pivot5_data(stages, ontime_delay, delay_category, months)


@app.get("/api/chart1")
def get_chart1(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
):
    """Return month-wise, stage-wise PO line counts for stacked bar chart."""
    return data.get_chart1_data(stages, ontime_delay, delay_category, months)
