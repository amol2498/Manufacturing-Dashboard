import pandas as pd
import os
import io
import time
from threading import Lock

EXCEL_PATH = os.environ.get(
    "EXCEL_PATH",
    r"C:\Users\AmolManthalkar\Downloads\Proactove OTD Risk Line Identification tool _04.23.xlsx"
)

# Per-session storage keyed by session_id (UUID from the browser).
# Each session is isolated: uploads affect only that session's DataFrame.
_sessions: dict = {}
_sessions_lock = Lock()


def _get_session(session_id: str) -> dict:
    with _sessions_lock:
        if session_id not in _sessions:
            _sessions[session_id] = {
                'df': pd.DataFrame(),
                'tab3_current': None,
                'tab3_previous': None,
                'version': 0,
                'last_accessed': time.time(),
            }
        else:
            _sessions[session_id]['last_accessed'] = time.time()
        return _sessions[session_id]


def _bump_version(session_id: str) -> None:
    _get_session(session_id)['version'] = int(time.time() * 1000)


def get_data_version(session_id: str) -> int:
    return _get_session(session_id)['version']


def _parse_date_column(series: pd.Series) -> pd.Series:
    """
    Robustly parse a date column that may contain a mix of:
    - Python datetime / date objects (from openpyxl Date cells)
    - Excel serial-date integers (cells formatted as General/Number)
    - Date strings in dd-mm-yyyy format ("30-01-2025", "30/01/2025", "30 Jan 2025", …)
    """
    result = pd.to_datetime(series, dayfirst=True, errors="coerce")

    nat = result.isna() & series.notna()
    if nat.any():
        result[nat] = pd.to_datetime(series[nat], errors="coerce")

    nat = result.isna() & series.notna()
    if nat.any():
        numeric = pd.to_numeric(series[nat], errors="coerce")
        valid_num = numeric.notna()
        if valid_num.any():
            idx = numeric[valid_num].index
            result[idx] = pd.Timestamp("1899-12-30") + pd.to_timedelta(
                numeric[valid_num].astype(int), unit="D"
            )

    return result


def _parse_excel(source) -> pd.DataFrame:
    """Parse Excel from a file path string or BytesIO, auto-detecting the header row."""
    for header_row in [0, 1]:
        if hasattr(source, "seek"):
            source.seek(0)
        df = pd.read_excel(
            source,
            sheet_name="Supplier- Base sheet",
            header=header_row,
            engine="openpyxl",
            engine_kwargs={"data_only": True},
        )
        df.columns = df.columns.str.strip()
        if "PO #" in df.columns:
            break
    else:
        raise ValueError(f"'PO #' column not found. Columns present: {df.columns.tolist()}")

    df = df.dropna(subset=["PO #"])
    df["Due Date"] = _parse_date_column(df["Due Date"])
    df["Month"] = df["Due Date"].dt.strftime("%b'%y")
    df["Month_Sort"] = df["Due Date"].dt.to_period("M").astype(str)
    df["Stages"] = df["Stages"].fillna("Unknown")
    df["Ontime/Delay"] = df["Ontime/Delay"].fillna("Unknown")
    df["Delay Category"] = df["Delay Category"].fillna("Unknown")

    if "Dock Month" in df.columns:
        df["Dock Month"] = _parse_date_column(df["Dock Month"])
        df["Dock_Month_Label"] = df["Dock Month"].dt.strftime("%b'%y")
        df["Dock_Month_Sort"]  = df["Dock Month"].dt.to_period("M").astype(str)
    else:
        df["Dock_Month_Label"] = pd.NA
        df["Dock_Month_Sort"]  = pd.NA

    today = pd.Timestamp.now().normalize()
    not_shipped = df["Stages"].str.strip().str.lower() != "shipped"
    df["Past_Due"] = df["Due Date"].notna() & (df["Due Date"] < today) & not_shipped

    return df


def reload_data(file_bytes: bytes, session_id: str) -> None:
    session = _get_session(session_id)
    session['df'] = _parse_excel(io.BytesIO(file_bytes))
    _bump_version(session_id)


def get_df(session_id: str) -> pd.DataFrame:
    return _get_session(session_id)['df']


def reload_tab3_current(file_bytes: bytes, session_id: str) -> None:
    session = _get_session(session_id)
    session['tab3_current'] = _parse_excel(io.BytesIO(file_bytes))
    _bump_version(session_id)


def reload_tab3_previous(file_bytes: bytes, session_id: str) -> None:
    session = _get_session(session_id)
    session['tab3_previous'] = _parse_excel(io.BytesIO(file_bytes))
    _bump_version(session_id)


def get_tab3_current_df(session_id: str):
    return _get_session(session_id)['tab3_current']


def get_tab3_previous_df(session_id: str):
    return _get_session(session_id)['tab3_previous']


def apply_filters(df, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    if supplier_names:
        df = df[df["Supplier Name"].isin(supplier_names)]
    if stages:
        df = df[df["Stages"].isin(stages)]
    if ontime_delay:
        df = df[df["Ontime/Delay"].isin(ontime_delay)]
    if delay_category:
        df = df[df["Delay Category"].isin(delay_category)]
    if months:
        df = df[df["Month"].isin(months)]
    if item_number and item_number.strip():
        df = df[df["Item #"].astype(str).str.contains(item_number.strip(), case=False, na=False)]
    if po_number and po_number.strip():
        df = df[df["PO #"].astype(str).str.contains(po_number.strip(), case=False, na=False)]
    return df


def get_filter_options(session_id: str):
    df = get_df(session_id)
    if df.empty or "Supplier Name" not in df.columns:
        return {"supplier_names": [], "stages": [], "ontime_delay": [], "delay_category": [], "months": []}
    month_df = (
        df.dropna(subset=["Month"])
        .drop_duplicates(subset=["Month", "Month_Sort"])
        .sort_values("Month_Sort")
    )
    return {
        "supplier_names": sorted(df["Supplier Name"].dropna().unique().tolist()),
        "stages": sorted(df["Stages"].dropna().unique().tolist()),
        "ontime_delay": sorted(df["Ontime/Delay"].dropna().unique().tolist()),
        "delay_category": sorted(df["Delay Category"].dropna().unique().tolist()),
        "months": month_df["Month"].tolist(),
    }


def get_pivot1_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    full_df = get_df(session_id)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"rows": [], "columns": ["Stages", "Total"]}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    )

    valid = df.dropna(subset=["Month"])
    all_stages = sorted(valid["Stages"].dropna().unique().tolist())

    rows = []
    month_totals = {m: 0 for m in month_order}

    for stage in all_stages:
        stage_df = valid[valid["Stages"] == stage]
        row = {"Stages": stage}
        stage_total = 0
        for month in month_order:
            count = int((stage_df["Month"] == month).sum())
            row[month] = count
            month_totals[month] += count
            stage_total += count
        row["Total"] = stage_total
        rows.append(row)

    rows.sort(key=lambda r: r["Total"], reverse=True)

    grand_total = {"Stages": "Grand Total"}
    for m in month_order:
        grand_total[m] = month_totals[m]
    grand_total["Total"] = sum(month_totals.values())
    rows.append(grand_total)

    return {
        "rows": rows,
        "columns": ["Stages"] + month_order + ["Total"],
    }


def get_pivot2_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    full_df = get_df(session_id)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"rows": [], "columns": ["Stages", "Total"]}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    )

    valid = df.dropna(subset=["Month"])
    all_stages = sorted(valid["Stages"].dropna().unique().tolist())

    month_totals = {m: int((valid["Month"] == m).sum()) for m in month_order}
    grand_total  = sum(month_totals.values())

    def pct(n, d): return round(n / d * 100, 1) if d else 0.0

    rows = []
    stage_totals = {}
    for stage in all_stages:
        stage_df = valid[valid["Stages"] == stage]
        row = {"Stages": stage}
        stage_grand = 0
        for month in month_order:
            count = int((stage_df["Month"] == month).sum())
            row[month] = pct(count, month_totals[month])
            stage_grand += count
        stage_totals[stage] = stage_grand
        row["Total"] = pct(stage_grand, grand_total)
        rows.append(row)

    rows.sort(key=lambda r: stage_totals[r["Stages"]], reverse=True)

    total_row = {"Stages": "Total"}
    for m in month_order:
        total_row[m] = pct(month_totals[m], month_totals[m])
    total_row["Total"] = pct(grand_total, grand_total)
    rows.append(total_row)

    return {"rows": rows, "columns": ["Stages"] + month_order + ["Total"]}


def get_pivot4_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    full_df = get_df(session_id)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"rows": [], "columns": ["Metric", "Total"]}

    month_meta = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")
    )
    month_order    = month_meta["Month"].tolist()
    month_sort_map = month_meta.set_index("Month")["Month_Sort"].to_dict()

    valid = df.dropna(subset=["Month"])

    def pct(n, d): return round(n / d * 100, 1) if d else 0.0

    OTD_START = "2026-04"

    month_stats = {}
    for month in month_order:
        mdf = valid[valid["Month"] == month]
        total    = len(mdf)
        norm     = mdf["Ontime/Delay"].str.strip().str.lower()
        ontime   = int((norm == "on time").sum())
        delay    = int((norm == "delay").sum())
        past_due = int(mdf["Past_Due"].sum())

        m_sort = month_sort_map.get(month, "")

        if m_sort >= OTD_START:
            cum_df  = valid[valid["Month_Sort"] <= m_sort]
            cum_tot = len(cum_df)
            cum_on  = int((cum_df["Ontime/Delay"].str.strip().str.lower() == "on time").sum())
            otd_with = pct(cum_on, cum_tot)
            otd_without = pct(ontime, total)
        else:
            otd_with    = 0.0
            otd_without = 0.0

        month_stats[month] = {
            "ontime":      ontime,
            "delay":       delay,
            "past_due":    past_due,
            "total":       total,
            "otd_with":    otd_with,
            "otd_without": otd_without,
        }

    t_ontime   = sum(v["ontime"]   for v in month_stats.values())
    t_delay    = sum(v["delay"]    for v in month_stats.values())
    t_past_due = sum(v["past_due"] for v in month_stats.values())
    t_all      = sum(v["total"]    for v in month_stats.values())

    rows = [
        {"Metric": "Ontime",      **{m: month_stats[m]["ontime"]   for m in month_order}, "Total": t_ontime},
        {"Metric": "Delay",       **{m: month_stats[m]["delay"]    for m in month_order}, "Total": t_delay},
        {"Metric": "Past Due",    **{m: month_stats[m]["past_due"] for m in month_order}, "Total": t_past_due},
        {"Metric": "Total Lines", **{m: month_stats[m]["total"]    for m in month_order}, "Total": t_all},
        {
            "Metric": "% OTD with Past Due",
            **{m: month_stats[m]["otd_with"] for m in month_order},
            "Total": pct(t_ontime, t_all),
        },
        {
            "Metric": "% OTD without Past Due",
            **{m: month_stats[m]["otd_without"] for m in month_order},
            "Total": pct(t_ontime, t_all),
        },
    ]

    return {"rows": rows, "columns": ["Metric"] + month_order + ["Total"]}


def get_chart2_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    full_df = get_df(session_id)
    denom_df = apply_filters(full_df, None, ontime_delay, delay_category, months, supplier_names, item_number, po_number)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"data": [], "stages": []}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")[["Month_Sort", "Month"]]
        .values.tolist()
    )

    valid = df.dropna(subset=["Month"])
    denom_valid = denom_df.dropna(subset=["Month"])
    all_stages = sorted(valid["Stages"].dropna().unique().tolist())
    month_totals = {m: int((denom_valid["Month"] == m).sum()) for _, m in month_order}

    def pct(n, d): return round(n / d * 100, 1) if d else 0.0

    chart_records = []
    for month_sort, month in month_order:
        month_df = valid[valid["Month"] == month]
        if month_df.empty and month_totals[month] == 0:
            continue
        record = {"Month": month}
        for stage in all_stages:
            count = int((month_df["Stages"] == stage).sum())
            record[stage] = pct(count, month_totals[month])
        chart_records.append(record)

    return {"data": chart_records, "stages": all_stages}


def get_chart1_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    df = get_df(session_id)
    df = apply_filters(df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"data": [], "stages": []}

    all_stages = sorted(df["Stages"].dropna().unique().tolist())
    grouped = (
        df.groupby(["Month_Sort", "Month", "Stages"])
        .size()
        .reset_index(name="Count")
        .sort_values("Month_Sort")
    )

    chart_records = []
    for (month_sort, month), group in grouped.groupby(["Month_Sort", "Month"], sort=False):
        record = {"Month": month}
        for _, row in group.iterrows():
            record[row["Stages"]] = int(row["Count"])
        chart_records.append(record)

    return {"data": chart_records, "stages": all_stages}


def get_pivot3_data(session_id, stages=None, ontime_delay=None, delay_category=None, months=None, supplier_names=None, item_number=None, po_number=None):
    session = _get_session(session_id)
    curr_df = session['tab3_current']
    prev_df = session['tab3_previous']

    has_current  = curr_df is not None and not curr_df.empty
    has_previous = prev_df is not None and not prev_df.empty

    if not has_current and not has_previous:
        return {"stages": [], "months": [], "data": {}, "grand_total": {},
                "has_current": False, "has_previous": False}

    f_curr = apply_filters(curr_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number) if has_current  else curr_df
    f_prev = apply_filters(prev_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number) if has_previous else prev_df

    month_parts = []
    if has_current:
        month_parts.append(f_curr.dropna(subset=["Month"]).drop_duplicates(["Month", "Month_Sort"]))
    if has_previous:
        month_parts.append(f_prev.dropna(subset=["Month"]).drop_duplicates(["Month", "Month_Sort"]))
    month_order = (
        pd.concat(month_parts)
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    ) if month_parts else []

    stages_set = set()
    if has_current:
        stages_set.update(f_curr["Stages"].dropna().unique())
    if has_previous:
        stages_set.update(f_prev["Stages"].dropna().unique())
    all_stages = sorted(stages_set)

    data_out = {}
    grand_current  = {m: 0 for m in month_order}
    grand_previous = {m: 0 for m in month_order}

    for stage in all_stages:
        data_out[stage] = {}
        for month in month_order:
            c = int(((f_curr["Stages"] == stage) & (f_curr["Month"] == month)).sum()) if has_current  else 0
            p = int(((f_prev["Stages"] == stage) & (f_prev["Month"] == month)).sum()) if has_previous else 0
            data_out[stage][month] = {"current": c, "previous": p}
            grand_current[month]  += c
            grand_previous[month] += p

    grand_total = {m: {"current": grand_current[m], "previous": grand_previous[m]} for m in month_order}

    return {
        "stages":      all_stages,
        "months":      month_order,
        "data":        data_out,
        "grand_total": grand_total,
        "has_current":  has_current,
        "has_previous": has_previous,
    }


def get_pivot5_data(session_id, stages, ontime_delay, delay_category, months, supplier_names=None, item_number=None, po_number=None):
    full_df = get_df(session_id)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months, supplier_names, item_number, po_number)

    if df.empty:
        return {"rows": [], "columns": ["Metric", "Total"]}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    )

    month_meta = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .set_index("Month")["Month_Sort"]
        .to_dict()
    )

    valid = df.dropna(subset=["Month"])

    delay_counts    = {}
    past_due_counts = {}
    for month in month_order:
        m_sort  = month_meta.get(month, "")
        cum_df  = valid[valid["Month_Sort"] <= m_sort] if m_sort else valid.iloc[:0]
        cum_norm = cum_df["Ontime/Delay"].str.strip().str.lower()
        delay_counts[month] = int((cum_norm == "delay").sum())
        past_due_counts[month] = delay_counts[month]

    dock_valid  = df.dropna(subset=["Dock_Month_Label"])
    dock_series = dock_valid.groupby("Dock_Month_Label").size()
    dock_counts = {m: int(dock_series.get(m, 0)) for m in month_order}

    t_delay    = sum(delay_counts.values())
    t_dock     = sum(dock_counts.values())
    t_past_due = past_due_counts[month_order[-1]] if month_order else 0

    total_counts = {m: int((valid["Month"] == m).sum()) for m in month_order}
    t_all = sum(total_counts.values())

    rows = [
        {"Metric": "Delay Line",          **delay_counts,    "Total": t_delay},
        {"Metric": "Docking Lines",        **dock_counts,     "Total": t_dock},
        {"Metric": "Total Past Due Lines", **past_due_counts, "Total": t_past_due},
        {"Metric": "Total Lines",          **total_counts,    "Total": t_all},
    ]

    return {"rows": rows, "columns": ["Metric"] + month_order + ["Total"]}


def parse_otd_risk_sheets(file_bytes: bytes):
    """Parse LW_Data and CW_Data sheets from the OTD Risk Excel file.
    Data is expected from Excel row 4 onwards (rows 1-3 are skipped).
    Returns (cw_df, lw_df) as raw DataFrames with positional column indices.
    """
    source = io.BytesIO(file_bytes)
    cw_df = pd.read_excel(
        source, sheet_name='CW_Data', header=None, skiprows=3,
        engine='openpyxl', engine_kwargs={'data_only': True},
    )
    source.seek(0)
    lw_df = pd.read_excel(
        source, sheet_name='LW_Data', header=None, skiprows=3,
        engine='openpyxl', engine_kwargs={'data_only': True},
    )
    return cw_df, lw_df


def compute_supplier_otd_report(cw_df: pd.DataFrame) -> list:
    """Compute SUPPLIER OTD report from CW_Data sheet.

    Column mapping mirrors the Excel formula positions (0-indexed):
      B = 1  → Supplier
      J = 9  → On Time / Delay status  (CW Lines and On Time count)
      N = 13 → Delay indicator column  (Delayed count)

    Excel formula equivalents:
      CW Lines   = COUNTIFS(B, supplier, J, "On time") + COUNTIFS(B, supplier, J, "Delay")
      On Time    = COUNTIFS(B, supplier, J, "On time")
      Delayed    = COUNTIFS(B, supplier, N, "Delay")
      OTD %      = On Time / CW Lines   (as percentage, 0-100 scale)
      Gap to 95% = OTD % - 95
    """
    COL_SUPPLIER = 1
    COL_J = 9
    COL_N = 13

    if cw_df.shape[1] <= COL_SUPPLIER:
        return []

    sup_series = cw_df.iloc[:, COL_SUPPLIER].astype(str).str.strip()
    suppliers = sorted(
        s for s in sup_series.unique()
        if s and s.lower() not in ('nan', 'none', '')
    )

    j_series = (
        cw_df.iloc[:, COL_J].astype(str).str.strip().str.lower()
        if cw_df.shape[1] > COL_J else pd.Series(dtype=str)
    )
    n_series = (
        cw_df.iloc[:, COL_N].astype(str).str.strip().str.lower()
        if cw_df.shape[1] > COL_N else pd.Series(dtype=str)
    )

    rows = []
    for supplier in suppliers:
        mask = sup_series == supplier

        cw_lines = int((mask & j_series.isin(['on time', 'delay'])).sum()) if len(j_series) else 0
        on_time  = int((mask & (j_series == 'on time')).sum())             if len(j_series) else 0
        delayed  = int((mask & (n_series == 'delay')).sum())               if len(n_series) else 0

        otd_pct    = round(on_time / cw_lines * 100, 1) if cw_lines > 0 else 0.0
        gap_to_95  = round(otd_pct - 95.0, 1)

        rows.append({
            'supplier':   supplier,
            'cw_lines':   cw_lines,
            'on_time':    on_time,
            'delayed':    delayed,
            'otd_pct':    otd_pct,
            'gap_to_95':  gap_to_95,
        })

    return rows


def get_records_data(session_id, month, stage, item_number=None, po_number=None):
    df = get_df(session_id)
    if df.empty or "Month" not in df.columns or "Stages" not in df.columns:
        return []

    mask = (df["Month"].astype(str) == str(month)) & (df["Stages"].astype(str) == str(stage))
    filtered_df = df.loc[mask]

    if item_number and item_number.strip():
        filtered_df = filtered_df[filtered_df["Item #"].astype(str).str.contains(item_number.strip(), case=False, na=False)]
    if po_number and po_number.strip():
        filtered_df = filtered_df[filtered_df["PO #"].astype(str).str.contains(po_number.strip(), case=False, na=False)]

    return filtered_df.fillna("").to_dict('records')
