import pandas as pd
import openpyxl
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


def _otdr_col(df, names, fallback_idx):
    """Flexible column accessor: tries each name (case-insensitive) then falls back to positional index.
    Always returns a lowercased, stripped Series ready for comparison.
    """
    col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
    for name in (names if isinstance(names, list) else [names]):
        key = name.replace('\xa0', ' ').strip().lower()
        if key in col_lower:
            return df[col_lower[key]].astype(str).str.replace('\xa0', ' ', regex=False).str.strip().str.lower()
    if fallback_idx is not None and df.shape[1] > fallback_idx:
        return df.iloc[:, fallback_idx].astype(str).str.replace('\xa0', ' ', regex=False).str.strip().str.lower()
    return pd.Series(dtype=str)


def _valid_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Keep only rows where the Supplier column (B, index 1) has a real value."""
    col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
    col = next((col_lower[k] for k in ['supplier', 'supplier name'] if k in col_lower), None)
    sup = df[col] if col else df.iloc[:, 1]
    mask = sup.notna() & (sup.astype(str).str.replace('\xa0', ' ').str.strip().str.lower().ne('nan')) & (sup.astype(str).str.replace('\xa0', ' ').str.strip().ne(''))
    return df[mask]


def compute_summary_stats(cw_df: pd.DataFrame, lw_df: pd.DataFrame) -> dict:
    """Compute 6-card summary banner statistics from CW_Data and LW_Data sheets."""
    # Keep raw DataFrames for counts that don't require a supplier (e.g. Past Due)
    cw_raw = cw_df
    lw_raw = lw_df

    # Apply supplier-row filter so all supplier-scoped counts match Excel's implicit row scope
    cw_df = _valid_rows(cw_df)
    lw_df = _valid_rows(lw_df)

    cw_total = len(cw_df)
    lw_total = len(lw_df)

    # Stage column (col I, index 8) and On-Time/Delay column (col J, index 9)
    cw_i = _otdr_col(cw_df, ['stage', 'stages'], 8)
    cw_j = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)
    lw_i = _otdr_col(lw_df, ['stage', 'stages'], 8)
    lw_j = _otdr_col(lw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    # Section 2 – OTD RATE
    # Row 1 (CW): COUNTIFS(Stage="Shipped", On-Time/Delay="On time") / COUNTIFS(Stage="Shipped")
    cw_shipped        = int((cw_i == 'shipped').sum())
    cw_shipped_ontime = int(((cw_i == 'shipped') & (cw_j == 'on time')).sum())
    cw_otd_rate = round(cw_shipped_ontime / cw_shipped * 100, 1) if cw_shipped > 0 else 0.0

    # Row 3 (LW): same formula × 100 (raw, unrounded like Excel text concat)
    lw_shipped        = int((lw_i == 'shipped').sum())
    lw_shipped_ontime = int(((lw_i == 'shipped') & (lw_j == 'on time')).sum())
    lw_otd_rate = lw_shipped_ontime / lw_shipped * 100 if lw_shipped > 0 else 0.0

    # Section 3 – DELAYED LINES
    # Row 1 (CW): count where On-Time/Delay = "Delay"
    cw_delayed = int((cw_j == 'delay').sum())
    # Row 3 (LW): count where Status = "Delay"
    lw_status  = _otdr_col(lw_df, 'status', 13)
    lw_delayed = int((lw_status == 'delay').sum())

    # Section 5 – NEW DELAYS THIS WK
    # Row 1: CW On-Time/Delay="Delay" − LW On-Time/Delay="Delay"  (both use On-Time/Delay column)
    lw_j_delayed   = int((lw_j == 'delay').sum())
    net_new_delays = cw_delayed - lw_j_delayed

    # Row 3: "Resolved " + (LW Status="Delay" count − CW Status="Delay" count)
    cw_status = _otdr_col(cw_df, 'status', 13)
    resolved  = lw_delayed - int((cw_status == 'delay').sum())

    # Section 6 – PAST DUE
    # Dynamic formula (mirrors Excel): Stage != "Shipped" AND Due Date (col G) < TODAY()
    today = pd.Timestamp.now().normalize()
    cw_i_raw = _otdr_col(cw_raw, ['stage', 'stages'], 8)
    not_shipped_raw = cw_i_raw != 'shipped'
    due_col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in cw_raw.columns}
    due_col_name = next(
        (due_col_lower[k] for k in ['due date', 'due_date', 'duedate', 'delivery date', 'planned delivery date'] if k in due_col_lower),
        None
    )
    due_series = cw_raw[due_col_name] if due_col_name else cw_raw.iloc[:, 6]
    due_parsed = _parse_date_column(due_series)
    past_due = int((not_shipped_raw & (due_parsed < today)).sum())

    # Section 4 – MAX DAYS LATE
    # Row 1 & Row 3: max numeric value from "Days Late" column in CW_Data
    def _max_days_late(df):
        col_lower = {str(c).strip().lower(): c for c in df.columns}
        col_name  = next((col_lower[k] for k in ['days late', 'days_late', 'dayslate'] if k in col_lower), None)
        if col_name:
            numeric = pd.to_numeric(df[col_name], errors='coerce')
            if numeric.notna().any():
                return int(numeric.max())
        return None

    max_days_late = _max_days_late(cw_df)

    return {
        # Section 1 – TOTAL CW LINES
        'cw_total':       cw_total,
        'lw_total':       lw_total,
        # Section 2 – OTD RATE (CW)
        'cw_otd_rate':    round(cw_otd_rate, 1),
        'lw_otd_rate':    lw_otd_rate,
        # Section 3 – DELAYED LINES (CW)
        'cw_delayed':     cw_delayed,
        'lw_delayed':     lw_delayed,
        # Section 4 – MAX DAYS LATE
        'max_days_late':  max_days_late,
        # Section 5 – NEW DELAYS THIS WK
        'net_new_delays': net_new_delays,
        'resolved':       resolved,
        # Section 6 – PAST DUE
        'past_due':       past_due,

    }


def _sheet_to_df(ws) -> pd.DataFrame:
    """Read an openpyxl worksheet into a DataFrame.
    Always uses row index 2 (Excel row 3) as the header — identical to pd.read_excel(header=2).
    Only data rows (index 3+) have blank rows filtered out, so all suppliers including late
    rows like PMI at row 986 are captured regardless of the file's declared used-range.
    """
    all_rows = list(ws.iter_rows(values_only=True))
    if len(all_rows) < 3:
        return pd.DataFrame()
    header = [
        str(h).replace('\xa0', ' ').strip() if h is not None else f'_col{i}'
        for i, h in enumerate(all_rows[2])
    ]
    data_rows = [
        [cell if cell is not None else '' for cell in row]
        for row in all_rows[3:]
        if any(cell is not None for cell in row)
    ]
    df = pd.DataFrame(data_rows, columns=header)
    df.columns = df.columns.astype(str).str.replace('\xa0', ' ', regex=False).str.strip()
    return df


def parse_otd_risk_sheets(file_bytes: bytes):
    """Parse LW_Data and CW_Data sheets from the OTD Risk Excel file.
    Excel row 3 is used as the column header row; data begins at Excel row 4.
    Uses openpyxl directly to read ALL non-blank rows regardless of used-range metadata.
    Returns (cw_df, lw_df) with named columns for reliable lookups.
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    cw_df = _sheet_to_df(wb['CW_Data'])
    lw_df = _sheet_to_df(wb['LW_Data'])
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

    sup_col_lower = {str(c).strip().lower(): c for c in cw_df.columns}
    sup_col_name  = next((sup_col_lower[k] for k in ['supplier', 'supplier name'] if k in sup_col_lower), None)
    sup_raw = (
        cw_df[sup_col_name].astype(str).str.replace('\xa0', ' ', regex=False).str.strip()
        if sup_col_name else cw_df.iloc[:, COL_SUPPLIER].astype(str).str.replace('\xa0', ' ', regex=False).str.strip()
    )
    sup_ci = sup_raw.str.lower()

    # Build display map: lowercase key → original display name (first occurrence wins)
    display_map: dict = {}
    for orig in sup_raw:
        key = orig.lower()
        if key and key not in ('nan', 'none', '') and key not in display_map:
            display_map[key] = orig

    suppliers = sorted(display_map.keys())

    j_series = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], COL_J)
    n_series = _otdr_col(cw_df, ['status'], COL_N)

    rows = []
    for sup_key in suppliers:
        supplier = display_map[sup_key]
        mask = sup_ci == sup_key

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


def compute_monthly_otd_report(cw_df: pd.DataFrame) -> list:
    """Compute Monthly OTD report from CW_Data.

    For each distinct month (current year) in the Month column:
      On Time = count(Month=m AND On-Time/Delay="On Time")
      Delayed  = count(Month=m AND On-Time/Delay="Delay")
      Total    = On Time + Delayed
      OTD %    = On Time / Total * 100
    """
    cw_df = _valid_rows(cw_df)

    col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in cw_df.columns}
    month_col_name = col_lower.get('month', None)
    if month_col_name is None:
        return []

    current_year = str(pd.Timestamp.now().year)
    month_raw    = cw_df[month_col_name].astype(str).str.replace('\xa0', ' ').str.strip()
    month_lower  = month_raw.str.lower()
    j_series     = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    months_unique = month_raw[month_raw.str.contains(current_year, na=False)].unique()

    _abbr = {'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
             'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}

    def _sort_key(m):
        parts = str(m).strip().split()
        return (parts[1] if len(parts) > 1 else '', _abbr.get(parts[0].lower()[:3], 0) if parts else 0)

    rows = []
    for month_display in sorted(months_unique, key=_sort_key):
        mask    = month_lower == month_display.lower()
        on_time = int((mask & (j_series == 'on time')).sum())
        delayed = int((mask & (j_series == 'delay')).sum())
        total   = on_time + delayed
        rows.append({
            'month':   month_display,
            'on_time': on_time  if total > 0 else None,
            'delayed': delayed  if total > 0 else None,
            'total':   total    if total > 0 else None,
            'otd_pct': round(on_time / total * 100, 1) if total > 0 else None,
        })

    return rows


def compute_site_otd_report(cw_df: pd.DataFrame) -> list:
    """Compute Site OTD report from CW_Data, grouped by Site column.

    Lines   = count(Site=s AND On-Time/Delay in ["On time","Delay"])
    On Time = count(Site=s AND On-Time/Delay="On time")
    Delayed = count(Site=s AND On-Time/Delay="Delay")
    OTD %   = On Time / Lines * 100
    Risk    = Critical(<80) | At Risk(80-91.99) | On Track(>=92) | No Data(0 lines)
    """
    cw_df = _valid_rows(cw_df)

    col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in cw_df.columns}
    site_col_name = next(
        (col_lower[k] for k in ['site', 'ship to site', 'ship site', 'plant', 'location', 'destination'] if k in col_lower),
        None
    )
    if site_col_name is None:
        return []

    site_series = cw_df[site_col_name].astype(str).str.replace('\xa0', ' ').str.strip()
    sites = sorted(s for s in site_series.unique() if s and s.lower() not in ('nan', 'none', ''))
    j_series = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    rows = []
    for site in sites:
        mask    = site_series == site
        lines   = int((mask & j_series.isin(['on time', 'delay'])).sum())
        on_time = int((mask & (j_series == 'on time')).sum())
        delayed = int((mask & (j_series == 'delay')).sum())
        otd_pct = round(on_time / lines * 100, 1) if lines > 0 else 0.0

        if lines == 0:
            risk_flag = 'no_data'
        elif otd_pct < 80:
            risk_flag = 'critical'
        elif otd_pct < 92:
            risk_flag = 'at_risk'
        else:
            risk_flag = 'on_track'

        rows.append({
            'site':      site,
            'lines':     lines,
            'on_time':   on_time,
            'delayed':   delayed,
            'otd_pct':   otd_pct,
            'risk_flag': risk_flag,
        })

    return rows


def compute_details_report(cw_df: pd.DataFrame) -> list:
    """Return all CW_Data rows where Status='Delay', with Aging Bucket calculated.
    Sorted by Days Late descending.
    """
    def _raw(df, names, idx):
        col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        for name in (names if isinstance(names, list) else [names]):
            if name.strip().lower() in col_lower:
                return df[col_lower[name.strip().lower()]]
        return df.iloc[:, idx] if idx is not None and df.shape[1] > idx else pd.Series([''] * len(df), index=df.index)

    def _clean(val):
        s = str(val).replace('\xa0', ' ').strip()
        return '' if s.lower() in ('nan', 'none', 'nat') else s

    def _fmt_date(val):
        if pd.isna(val) if hasattr(val, '__class__') and val.__class__.__name__ in ('float', 'NaTType') else False:
            return ''
        s = _clean(val)
        if not s:
            return ''
        try:
            return pd.Timestamp(val).strftime('%d-%b-%y')
        except Exception:
            return s

    status_col = _raw(cw_df, ['status'], 13).astype(str).str.replace('\xa0', ' ').str.strip().str.lower()
    delayed_df = cw_df[status_col == 'delay'].copy()
    if delayed_df.empty:
        return []

    item_col     = _raw(delayed_df, ['item #', 'item#', 'item number'], 3)
    po_col       = _raw(delayed_df, ['po #', 'po#', 'po number'], 4)
    supplier_col = _raw(delayed_df, ['supplier', 'supplier name'], 1)
    site_col     = _raw(delayed_df, ['site', 'location', 'plant'], 2)
    due_date_col = _raw(delayed_df, ['due date', 'due_date'], 6)
    days_late_col = _raw(delayed_df, ['days late', 'days_late'], 14)
    stage_col    = _raw(delayed_df, ['stage', 'stages'], 8)
    qty_col      = _raw(delayed_df, ['qty', 'quantity'], 5)
    category_col = _raw(delayed_df, ['delay category', 'delaycategory', 'delay_category'], 10)
    reason_col   = _raw(delayed_df, ['reason', 'delay reason'], 12)
    commit_col   = _raw(delayed_df, ['commit date', 'commitdate', 'commit_date'], 11)

    rows = []
    for i in range(len(delayed_df)):
        raw_dl = _clean(days_late_col.iloc[i])
        try:
            days_late = int(round(float(raw_dl))) if raw_dl else None
        except Exception:
            days_late = None

        if days_late is None:     aging = ''
        elif days_late > 60:      aging = '60+ Days'
        elif days_late > 30:      aging = '31-60 Days'
        elif days_late > 14:      aging = '15-30 Days'
        elif days_late > 7:       aging = '8-14 Days'
        else:                     aging = '1-7 Days'

        rows.append({
            'item_number':  _clean(item_col.iloc[i]),
            'po_number':    _clean(po_col.iloc[i]),
            'supplier':     _clean(supplier_col.iloc[i]),
            'site':         _clean(site_col.iloc[i]),
            'due_date':     _fmt_date(due_date_col.iloc[i]),
            'days_late':    days_late,
            'stage':        _clean(stage_col.iloc[i]),
            'qty_due':      _clean(qty_col.iloc[i]),
            'aging_bucket': aging,
            'category':     _clean(category_col.iloc[i]),
            'delay_reason': _clean(reason_col.iloc[i]),
            'commit_date':  _fmt_date(commit_col.iloc[i]),
        })

    rows.sort(key=lambda r: (r['days_late'] is None, -(r['days_late'] or 0)))
    return rows


def compute_wow_comparison(cw_df: pd.DataFrame, lw_df: pd.DataFrame) -> dict:
    """Compute all Metric-by-Metric comparison data for the WoW Comparison dashboard.

    OTD Rate formula:
      Numerator   = COUNTIFS(Stage="Shipped", On-Time/Delay="On time")
      Denominator = COUNTIFS(Stage="Shipped")
      OTD %       = Numerator / Denominator × 100
    """
    cw_raw = cw_df
    lw_raw = lw_df

    # OTD Rate %: computed on ALL rows (mirrors Excel COUNTIFS over the full sheet range)
    # COUNTIFS(Stage="Shipped", On-Time/Delay="On time") / COUNTIFS(Stage="Shipped")
    _lw_stage_raw  = _otdr_col(lw_raw, ['stage', 'stages'], 8)
    _cw_stage_raw  = _otdr_col(cw_raw, ['stage', 'stages'], 8)
    _lw_status_raw = _otdr_col(lw_raw, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)
    _cw_status_raw = _otdr_col(cw_raw, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    _lw_shipped = _lw_stage_raw == 'shipped'
    _cw_shipped = _cw_stage_raw == 'shipped'
    lw_otd = round(float((_lw_shipped & (_lw_status_raw == 'on time')).sum() / _lw_shipped.sum() * 100), 1) if _lw_shipped.sum() > 0 else 0.0
    cw_otd = round(float((_cw_shipped & (_cw_status_raw == 'on time')).sum() / _cw_shipped.sum() * 100), 1) if _cw_shipped.sum() > 0 else 0.0

    # All other metrics use supplier-filtered rows
    cw_df = _valid_rows(cw_df)
    lw_df = _valid_rows(lw_df)

    cw_stage  = _otdr_col(cw_df, ['stage', 'stages'], 8)
    lw_stage  = _otdr_col(lw_df, ['stage', 'stages'], 8)
    cw_status = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)
    lw_status = _otdr_col(lw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    # Delayed lines
    lw_delayed_mask = lw_status == 'delay'
    cw_delayed_mask = cw_status == 'delay'
    lw_delayed_count = int(lw_delayed_mask.sum())
    cw_delayed_count = int(cw_delayed_mask.sum())

    # Max days late
    def _max_days(df):
        col_lower = {str(c).strip().lower(): c for c in df.columns}
        col = next((col_lower[k] for k in ['days late', 'days_late', 'dayslate'] if k in col_lower), None)
        if col:
            n = pd.to_numeric(df[col], errors='coerce')
            return int(n.max()) if n.notna().any() else 0
        return 0

    # Past due: COUNTIF(Delay Category = "Past Due")  — mirrors Excel formula =COUNTIF(K4:K3000,"Past Due")
    def _past_due(df):
        dc = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        col = next((dc[k] for k in ['delay category', 'delay_category', 'delaycategory', 'category'] if k in dc), None)
        s = df[col].astype(str).str.replace('\xa0', ' ').str.strip().str.lower() if col else df.iloc[:, 10].astype(str).str.replace('\xa0', ' ').str.strip().str.lower()
        return int((s == 'past due').sum())

    # Supplier column
    def _sup_series(df):
        dc = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        col = next((dc[k] for k in ['supplier', 'supplier name'] if k in dc), None)
        s = df[col] if col else df.iloc[:, 1]
        return s.astype(str).str.replace('\xa0', ' ').str.strip()

    # Site column
    def _site_series(df):
        dc = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        col = next((dc[k] for k in ['site', 'plant', 'location'] if k in dc), None)
        s = df[col] if col else df.iloc[:, 2]
        return s.astype(str).str.replace('\xa0', ' ').str.strip()

    lw_sup  = _sup_series(lw_df)
    cw_sup  = _sup_series(cw_df)
    lw_site = _site_series(lw_df)
    cw_site = _site_series(cw_df)

    # Case-insensitive versions for comparison
    lw_sup_ci  = lw_sup.str.lower()
    cw_sup_ci  = cw_sup.str.lower()
    lw_site_ci = lw_site.str.lower()
    cw_site_ci = cw_site.str.lower()

    def _clean_vals(s):
        return s[s.notna() & (s != '') & (s.str.lower() != 'nan')].tolist()

    def _display_map(lw_s, cw_s):
        dm = {}
        for v in _clean_vals(lw_s):
            dm.setdefault(v.lower(), v)
        for v in _clean_vals(cw_s):
            dm[v.lower()] = v          # CW takes precedence for display
        return dm

    sup_dm  = _display_map(lw_sup, cw_sup)
    site_dm = _display_map(lw_site, cw_site)

    supplier_rows = [
        {'name': sup_dm[k],
         'lw': int(((lw_sup_ci == k) & lw_delayed_mask).sum()),
         'cw': int(((cw_sup_ci == k) & cw_delayed_mask).sum())}
        for k in sorted(sup_dm)
    ]
    site_rows = [
        {'name': site_dm[k],
         'lw': int(((lw_site_ci == k) & lw_delayed_mask).sum()),
         'cw': int(((cw_site_ci == k) & cw_delayed_mask).sum())}
        for k in sorted(site_dm)
    ]

    return {
        'total_lines':   {'lw': len(lw_df),         'cw': len(cw_df)},
        'otd_rate':      {'lw': lw_otd,              'cw': cw_otd},
        'delayed_lines': {'lw': lw_delayed_count,    'cw': cw_delayed_count},
        'max_days_late': {'lw': _max_days(lw_df),    'cw': _max_days(cw_df)},
        'past_due':      {'lw': _past_due(lw_raw), 'cw': _past_due(cw_raw)},
        'supplier_rows': supplier_rows,
        'site_rows':     site_rows,
    }


def compute_supplier_delay_trend(cw_df: pd.DataFrame, lw_df: pd.DataFrame) -> list:
    """Compute Supplier Delay Trend (WoW) for each unique supplier.

    For each supplier:
      LW Delays = COUNTIFS(LW_Data.Supplier=name, LW_Data.On-Time/Delay="Delay")
      CW Delays = COUNTIFS(CW_Data.Supplier=name, CW_Data.On-Time/Delay="Delay")
      Delta     = CW Delays - LW Delays
      Trend     = "✅ Improved" if CW < LW, else "🔴 Worsened"

    Sorted by Delta descending (worst/most-worsened first).
    """
    def _sup(df):
        dc = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        col = next((dc[k] for k in ['supplier', 'supplier name'] if k in dc), None)
        s = df[col] if col else df.iloc[:, 1]
        return s.astype(str).str.replace('\xa0', ' ').str.strip()

    cw_sup    = _sup(cw_df)
    lw_sup    = _sup(lw_df)
    cw_sup_ci = cw_sup.str.lower()
    lw_sup_ci = lw_sup.str.lower()

    cw_j   = _otdr_col(cw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)
    lw_j   = _otdr_col(lw_df, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)

    cw_delay = cw_j == 'delay'
    lw_delay = lw_j == 'delay'

    def _valid(s):
        return [v for v in s.unique() if v and v.lower() not in ('nan', 'none', '')]

    # Case-insensitive dedup: build display map (CW takes precedence)
    display_map: dict = {}
    for v in _valid(lw_sup): display_map.setdefault(v.lower(), v)
    for v in _valid(cw_sup): display_map[v.lower()] = v

    rows = []
    for sup_key, sup_display in display_map.items():
        lw_count = int(((lw_sup_ci == sup_key) & lw_delay).sum())
        cw_count = int(((cw_sup_ci == sup_key) & cw_delay).sum())
        delta    = cw_count - lw_count
        trend    = '✅ Improved' if cw_count < lw_count else '🔴 Worsened'
        rows.append({
            'supplier':  sup_display,
            'lw_delays': lw_count,
            'cw_delays': cw_count,
            'delta':     delta,
            'trend':     trend,
        })

    rows.sort(key=lambda r: -r['delta'])
    return rows


def compute_otd_projections(cw_df: pd.DataFrame) -> dict:
    """Compute OTD Projections dashboard data from CW_Data sheet.

    Section 1 – Monthly OTD Summary: next 6 forward-looking months, one row per month.
    Section 2 – At-Risk Pipeline: orders in early/risky stages due within 60 days.

    Column mapping (0-indexed from spec):
      B=1  Supplier, C=2  Site,       D=3  Item #,
      G=6  Due Date, I=8  Stage,      J=9  On-Time/Delay,
      P=15 Days Until Due,            Q=16 Month
    """

    def _raw(df, names, idx):
        col_lower = {str(c).replace('\xa0', ' ').strip().lower(): c for c in df.columns}
        for name in (names if isinstance(names, list) else [names]):
            if name.strip().lower() in col_lower:
                return df[col_lower[name.strip().lower()]]
        return df.iloc[:, idx] if idx is not None and df.shape[1] > idx else pd.Series([''] * len(df), index=df.index)

    def _clean(val):
        s = str(val).replace('\xa0', ' ').strip()
        return '' if s.lower() in ('nan', 'none', 'nat') else s

    def _fmt_date(val):
        if pd.isna(val) if hasattr(val, '__class__') and val.__class__.__name__ in ('float', 'NaTType') else False:
            return ''
        s = _clean(val)
        if not s:
            return ''
        try:
            return pd.Timestamp(val).strftime('%d-%b-%y')
        except Exception:
            return s

    cw_valid = _valid_rows(cw_df)

    # Shared column accessors (all derived from cw_valid for index alignment)
    month_col    = _raw(cw_valid, ['month'], 16).astype(str).str.replace('\xa0', ' ').str.strip()
    j_col        = _otdr_col(cw_valid, ['on-time/delay', 'ontime/delay', 'on time/delay', 'ontime delay'], 9)
    stage_col    = _raw(cw_valid, ['stage', 'stages'], 8).astype(str).str.replace('\xa0', ' ').str.strip()
    days_due_raw = _raw(cw_valid, ['days until due', 'days_until_due', 'days due'], 15)
    days_due_num = pd.to_numeric(days_due_raw, errors='coerce')

    _abbr = {'jan':1,'feb':2,'mar':3,'apr':4,'may':5,'jun':6,
             'jul':7,'aug':8,'sep':9,'oct':10,'nov':11,'dec':12}

    def _parse_month_sort(m):
        parts = str(m).strip().split()
        if len(parts) >= 2:
            try:
                return (int(parts[1]), _abbr.get(parts[0].lower()[:3], 0))
            except ValueError:
                pass
        return (9999, 0)

    def _month_to_period(m):
        parts = str(m).strip().split()
        if len(parts) >= 2:
            try:
                year = int(parts[1])
                month_num = _abbr.get(parts[0].lower()[:3], 0)
                if month_num:
                    return pd.Period(year=year, month=month_num, freq='M')
            except Exception:
                pass
        return None

    today = pd.Timestamp.now().normalize()
    current_period = pd.Period(today, freq='M')

    all_months = sorted(
        [m for m in month_col.unique() if m and m.lower() not in ('nan', 'none', '')],
        key=_parse_month_sort
    )
    target_months = [m for m in all_months if (lambda p: p is not None and p >= current_period)(_month_to_period(m))][:6]

    # ── Section 1: Monthly OTD Summary ──────────────────────────────────────────
    monthly_summary = []
    for month in target_months:
        mask    = month_col.str.lower() == month.lower()
        on_time = int((mask & (j_col == 'on time')).sum())
        delayed = int((mask & (j_col == 'delay')).sum())
        total   = on_time + delayed

        if total > 0:
            otd_actual   = round(on_time / total * 100, 1)
            otd_forecast = round(otd_actual * 1.02, 1)
        else:
            otd_actual   = 0.0
            otd_forecast = 95.0

        if total == 0:
            risk_label, risk_level = 'No Data', 'no_data'
        elif otd_actual < 80:
            risk_label, risk_level = '🔴 CRITICAL — <80% Act immediately', 'critical'
        elif otd_actual < 90:
            risk_label, risk_level = '🔴 Below 90% target — Expedite delays', 'warning'
        elif otd_actual < 95:
            risk_label, risk_level = '🟡 Below 95% target — Monitor closely', 'caution'
        else:
            risk_label, risk_level = '🟢 On Target ≥95%', 'good'

        monthly_summary.append({
            'month':        month,
            'total_lines':  total,
            'on_time':      on_time,
            'delayed':      delayed,
            'otd_actual':   otd_actual,
            'otd_forecast': otd_forecast,
            'risk_label':   risk_label,
            'risk_level':   risk_level,
        })

    # ── Section 2: At-Risk Pipeline ─────────────────────────────────────────────
    AT_RISK_STAGES = frozenset({
        'initial stage', 'intermediate stage', 'yet to start',
        'yet to launch', 'no rm', 'intermediate',
    })

    supplier_col = _raw(cw_valid, ['supplier', 'supplier name'], 1).astype(str).str.replace('\xa0', ' ').str.strip()
    site_col     = _raw(cw_valid, ['site', 'location', 'plant'], 2).astype(str).str.replace('\xa0', ' ').str.strip()
    item_col     = _raw(cw_valid, ['item #', 'item#', 'item number'], 3).astype(str).str.replace('\xa0', ' ').str.strip()
    due_date_col = _raw(cw_valid, ['due date', 'due_date'], 6)

    at_risk_rows = []
    for i in range(len(cw_valid)):
        stage    = stage_col.iloc[i].lower().strip()
        days_due = days_due_num.iloc[i]

        if stage not in AT_RISK_STAGES:
            continue
        if pd.isna(days_due) or days_due <= 0 or days_due > 60:
            continue

        days_int = int(days_due)
        if   days_int <= 7:  risk_lv, risk_sort = '🚨 CRITICAL', 1
        elif days_int <= 14: risk_lv, risk_sort = '🔴 HIGH',     2
        elif days_int <= 30: risk_lv, risk_sort = '🟡 MEDIUM',   3
        else:                risk_lv, risk_sort = '🔵 WATCH',    4

        at_risk_rows.append({
            'item_number':    _clean(item_col.iloc[i]),
            'supplier':       _clean(supplier_col.iloc[i]),
            'site':           _clean(site_col.iloc[i]),
            'due_date':       _fmt_date(due_date_col.iloc[i]),
            'days_until_due': days_int,
            'stage':          _clean(stage_col.iloc[i]),
            'risk_level':     risk_lv,
            '_risk_sort':     risk_sort,
        })

    at_risk_rows.sort(key=lambda r: (r['days_until_due'], r['_risk_sort']))
    for r in at_risk_rows:
        del r['_risk_sort']

    # Dynamic date-range label (e.g. "May–Oct 2026")
    if len(target_months) >= 2:
        fp, lp = target_months[0].split(), target_months[-1].split()
        if len(fp) >= 2 and len(lp) >= 2:
            date_range_label = (
                f"{fp[0]}–{lp[0]} {fp[1]}" if fp[1] == lp[1]
                else f"{fp[0]} {fp[1]}–{lp[0]} {lp[1]}"
            )
        else:
            date_range_label = f"{target_months[0]} – {target_months[-1]}"
    elif len(target_months) == 1:
        date_range_label = target_months[0]
    else:
        date_range_label = ''

    return {
        'monthly_summary':  monthly_summary,
        'at_risk_pipeline': at_risk_rows,
        'date_range_label': date_range_label,
        'total_at_risk':    len(at_risk_rows),
    }


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
