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
    allow_origins=["http://localhost:5173", "http://localhost:3000", "https://otd-dashboard-app.azurewebsites.net"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/data-version")
def get_data_version(session_id: str = Query(...)):
    return {"version": data.get_data_version(session_id)}


@app.post("/api/upload")
async def upload_excel(session_id: str = Query(...), file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_data(contents, session_id)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_df(session_id))}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.post("/api/upload-tab3-current")
async def upload_tab3_current(session_id: str = Query(...), file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_tab3_current(contents, session_id)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_tab3_current_df(session_id))}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.post("/api/upload-tab3-previous")
async def upload_tab3_previous(session_id: str = Query(...), file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        data.reload_tab3_previous(contents, session_id)
        return {"message": f"'{file.filename}' loaded successfully", "rows": len(data.get_tab3_previous_df(session_id))}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.get("/api/filters")
def get_filters(session_id: str = Query(...)):
    return data.get_filter_options(session_id)


@app.get("/api/pivot1")
def get_pivot1(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_pivot1_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/pivot2")
def get_pivot2(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_pivot2_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/pivot3")
def get_pivot3(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_pivot3_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/pivot4")
def get_pivot4(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_pivot4_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/pivot5")
def get_pivot5(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_pivot5_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/chart1")
def get_chart1(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_chart1_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.get("/api/chart2")
def get_chart2(
    session_id: str = Query(...),
    stages: Optional[List[str]] = Query(default=None),
    ontime_delay: Optional[List[str]] = Query(default=None),
    delay_category: Optional[List[str]] = Query(default=None),
    months: Optional[List[str]] = Query(default=None),
    supplier_names: Optional[List[str]] = Query(default=None),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_chart2_data(session_id, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)


@app.post("/api/upload-otd-risk")
async def upload_otd_risk(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xls files are supported")
    try:
        contents = await file.read()
        cw_df, lw_df = data.parse_otd_risk_sheets(contents)
        supplier_otd  = data.compute_supplier_otd_report(cw_df)
        site_otd      = data.compute_site_otd_report(cw_df)
        monthly_otd   = data.compute_monthly_otd_report(cw_df)
        summary_stats = data.compute_summary_stats(cw_df, lw_df)
        return {
            "supplier_otd":   supplier_otd,
            "site_otd":       site_otd,
            "monthly_otd":    monthly_otd,
            "summary_stats":  summary_stats,
            "cw_rows":        len(cw_df),
            "lw_rows":        len(lw_df),
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {exc}")


@app.get("/api/records")
def get_records(
    session_id: str = Query(...),
    month: str = Query(...),
    stage: str = Query(...),
    item_number: Optional[str] = Query(default=None),
    po_number: Optional[str] = Query(default=None),
):
    return data.get_records_data(session_id, month, stage, item_number, po_number)
