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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FILTER_PARAMS = dict(
    stages        = Query(default=None),
    ontime_delay  = Query(default=None),
    delay_category= Query(default=None),
    months        = Query(default=None),
    supplier_names= Query(default=None),
)


@app.get("/api/debug/columns")
def debug_columns():
    import data as _data
    df = _data.get_df()
    return {"columns": df.columns.tolist()}


@app.get("/api/debug/dates")
def debug_dates():
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
    return {"total_rows": len(df), "unparsed_dock_month_rows": nat_count, "months": month_counts}


@app.post("/api/upload")
async def upload_excel(file: UploadFile = File(...)):
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


@app.post("/api/upload-tab3-current")
async def upload_tab3_current(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_tab3_current(contents)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_tab3_current_df())}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.post("/api/upload-tab3-previous")
async def upload_tab3_previous(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_tab3_previous(contents)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_tab3_previous_df())}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.get("/api/pivot3")
def get_pivot3(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_pivot3_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/filters")
def get_filters():
    return data.get_filter_options()


@app.get("/api/pivot1")
def get_pivot1(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_pivot1_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/pivot2")
def get_pivot2(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_pivot2_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/pivot4")
def get_pivot4(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_pivot4_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/chart2")
def get_chart2(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_chart2_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/pivot5")
def get_pivot5(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_pivot5_data(stages, ontime_delay, delay_category, months, supplier_names)


@app.get("/api/chart1")
def get_chart1(
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
):
    return data.get_chart1_data(stages, ontime_delay, delay_category, months, supplier_names)
