import pandas as pd
import os
import io

EXCEL_PATH = os.environ.get(
    "EXCEL_PATH",
    r"C:\Users\AmolManthalkar\Downloads\Proactove OTD Risk Line Identification tool _04.23.xlsx"
)

_df = None


def _parse_date_column(series: pd.Series) -> pd.Series:
    """
    Robustly parse a date column that may contain a mix of:
    - Python datetime / date objects (from openpyxl Date cells)
    - Excel serial-date integers (cells formatted as General/Number)
    - Date strings in dd-mm-yyyy format ("30-01-2025", "30/01/2025", "30 Jan 2025", …)
    """
    # Pass 1: dayfirst=True to correctly handle dd-mm-yyyy strings
    result = pd.to_datetime(series, dayfirst=True, errors="coerce")

    # Pass 2: remaining NaT — fallback without dayfirst for other formats
    nat = result.isna() & series.notna()
    if nat.any():
        result[nat] = pd.to_datetime(series[nat], errors="coerce")

    # Pass 3: remaining NaT — treat numeric values as Excel serial-date integers
    # (days since 1899-12-30, Excel's epoch)
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
        df = pd.read_excel(source, sheet_name="Supplier- Base sheet", header=header_row)
        df.columns = df.columns.str.strip()
        if "PO #" in df.columns:
            break
    else:
        raise ValueError(f"'PO #' column not found. Columns present: {df.columns.tolist()}")

    df = df.dropna(subset=["PO #"])
    df["Due Date"] = _parse_date_column(df["Due Date"])
    df["Month"] = df["Due Date"].dt.strftime("%b'%y")   # e.g. Jan'25, Mar'26
    df["Month_Sort"] = df["Due Date"].dt.to_period("M").astype(str)  # e.g. 2025-01
    df["Stages"] = df["Stages"].fillna("Unknown")
    df["Ontime/Delay"] = df["Ontime/Delay"].fillna("Unknown")
    df["Delay Category"] = df["Delay Category"].fillna("Unknown")

    # Dock Month column (used in Pivot 5)
    if "Dock Month" in df.columns:
        df["Dock Month"] = _parse_date_column(df["Dock Month"])
        df["Dock_Month_Label"] = df["Dock Month"].dt.strftime("%b'%y")
        df["Dock_Month_Sort"]  = df["Dock Month"].dt.to_period("M").astype(str)
    else:
        df["Dock_Month_Label"] = pd.NA
        df["Dock_Month_Sort"]  = pd.NA

    # Past Due: due date has passed today AND stage is not "Shipped"
    today = pd.Timestamp.now().normalize()
    not_shipped = df["Stages"].str.strip().str.lower() != "shipped"
    df["Past_Due"] = df["Due Date"].notna() & (df["Due Date"] < today) & not_shipped

    return df


def load_data() -> pd.DataFrame:
    return _parse_excel(EXCEL_PATH)


def reload_data(file_bytes: bytes) -> None:
    """Replace the cached DataFrame with data from uploaded file bytes."""
    global _df
    _df = _parse_excel(io.BytesIO(file_bytes))


def get_df() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = load_data()
    return _df


def apply_filters(df, stages, ontime_delay, delay_category, months):
    if stages:
        df = df[df["Stages"].isin(stages)]
    if ontime_delay:
        df = df[df["Ontime/Delay"].isin(ontime_delay)]
    if delay_category:
        df = df[df["Delay Category"].isin(delay_category)]
    if months:
        df = df[df["Month"].isin(months)]
    return df


def get_filter_options():
    df = get_df()
    month_df = (
        df.dropna(subset=["Month"])
        .drop_duplicates(subset=["Month", "Month_Sort"])
        .sort_values("Month_Sort")
    )
    return {
        "stages": sorted(df["Stages"].dropna().unique().tolist()),
        "ontime_delay": sorted(df["Ontime/Delay"].dropna().unique().tolist()),
        "delay_category": sorted(df["Delay Category"].dropna().unique().tolist()),
        "months": month_df["Month"].tolist(),
    }


def get_pivot1_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

    if df.empty:
        return {"rows": [], "columns": ["Stages", "Total"]}

    # Month column order from the FULL dataset so all months always appear as headers
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
def get_pivot2_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    # Denominator: all stages, only non-stage filters applied
    denom_df = apply_filters(full_df, None, ontime_delay, delay_category, months)
    # Numerator: all filters including stage
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

    if df.empty:
        return {"rows": [], "columns": ["Stages", "Total"]}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    )

    valid = df.dropna(subset=["Month"])
    denom_valid = denom_df.dropna(subset=["Month"])
    all_stages = sorted(valid["Stages"].dropna().unique().tolist())
    month_totals = {m: int((denom_valid["Month"] == m).sum()) for m in month_order}
    grand_total = sum(month_totals.values())

    def pct(n, d): return round(n / d * 100, 1) if d else 0.0

    rows = []
    for stage in all_stages:
        stage_df = valid[valid["Stages"] == stage]
        stage_total = len(stage_df)
        row = {"Stages": stage}
        for month in month_order:
            count = int((stage_df["Month"] == month).sum())
            row[month] = pct(count, month_totals[month])
        row["Total"] = pct(stage_total, grand_total)
        rows.append(row)

    rows.sort(key=lambda r: r["Total"], reverse=True)

    filtered_month_totals = {m: int((valid["Month"] == m).sum()) for m in month_order}
    filtered_grand_total = sum(filtered_month_totals.values())
    grand_total_row = {"Stages": "Grand Total"}
    for m in month_order:
        grand_total_row[m] = pct(filtered_month_totals[m], month_totals[m])
    grand_total_row["Total"] = pct(filtered_grand_total, grand_total)
    rows.append(grand_total_row)

    return {"rows": rows, "columns": ["Stages"] + month_order + ["Total"]}


def get_pivot2_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

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

    # Month totals (denominator for % calculation)
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
        total_row[m] = 0  # blank in UI
    total_row["Total"] = pct(grand_total, grand_total)
    rows.append(total_row)

    return {"rows": rows, "columns": ["Stages"] + month_order + ["Total"]}


def get_pivot4_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

    if df.empty:
        return {"rows": [], "columns": ["Metric", "Total"]}

    # All months from full dataset (chronological) for column headers
    month_meta = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")
    )
    month_order   = month_meta["Month"].tolist()
    month_sort_map = month_meta.set_index("Month")["Month_Sort"].to_dict()

    valid = df.dropna(subset=["Month"])

    def pct(n, d): return round(n / d * 100, 1) if d else 0.0

    OTD_START = "2026-04"  # % OTD rows only calculated for April 2026 onwards

    # Per-month counts
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
            # % OTD with Past Due — cumulative: on_time where due ≤ M / total where due ≤ M
            cum_df  = valid[valid["Month_Sort"] <= m_sort]
            cum_tot = len(cum_df)
            cum_on  = int((cum_df["Ontime/Delay"].str.strip().str.lower() == "on time").sum())
            otd_with = pct(cum_on, cum_tot)

            # % OTD without Past Due — monthly: on_time where due = M / total where due = M
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

    # Grand-total column
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


def get_chart2_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    denom_df = apply_filters(full_df, None, ontime_delay, delay_category, months)
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

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


def get_chart1_data(stages, ontime_delay, delay_category, months):
    df = get_df()
    df = apply_filters(df, stages, ontime_delay, delay_category, months)

    if df.empty:
        return {"data": [], "stages": []}

    all_stages = sorted(df["Stages"].dropna().unique().tolist())
    grouped = (
        df.groupby(["Month_Sort", "Month", "Stages"])
        .size()
        .reset_index(name="Count")
        .sort_values("Month_Sort")
    )

    # Build chart records: [{Month: "Mar 2026", "Stage1": n, "Stage2": n, ...}]
    chart_records = []
    for (month_sort, month), group in grouped.groupby(["Month_Sort", "Month"], sort=False):
        record = {"Month": month}
        for _, row in group.iterrows():
            record[row["Stages"]] = int(row["Count"])
        chart_records.append(record)

    return {"data": chart_records, "stages": all_stages}


def get_pivot5_data(stages, ontime_delay, delay_category, months):
    full_df = get_df()
    df = apply_filters(full_df, stages, ontime_delay, delay_category, months)

    if df.empty:
        return {"rows": [], "columns": ["Metric", "Total"]}

    month_order = (
        full_df.dropna(subset=["Month"])
        .drop_duplicates(["Month", "Month_Sort"])
        .sort_values("Month_Sort")["Month"]
        .tolist()
    )

    valid = df.dropna(subset=["Month"])

    delay_counts   = {}
    past_due_counts = {}
    for month in month_order:
        mdf = valid[valid["Month"] == month]
        delay_counts[month]    = int((mdf["Ontime/Delay"].str.strip().str.lower() == "delay").sum())
        past_due_counts[month] = int(mdf["Past_Due"].sum())

    # Docking Lines: group filtered rows by Dock Month label
    dock_valid = df.dropna(subset=["Dock_Month_Label"])
    dock_series = dock_valid.groupby("Dock_Month_Label").size()
    dock_counts = {m: int(dock_series.get(m, 0)) for m in month_order}

    t_delay    = sum(delay_counts.values())
    t_dock     = sum(dock_counts.values())
    t_past_due = sum(past_due_counts.values())

    total_counts = {m: int((valid["Month"] == m).sum()) for m in month_order}
    t_all = sum(total_counts.values())

    rows = [
        {"Metric": "Delay Line",          **delay_counts,    "Total": t_delay},
        {"Metric": "Docking Lines",        **dock_counts,     "Total": t_dock},
        {"Metric": "Total Past Due Lines", **past_due_counts, "Total": t_past_due},
        {"Metric": "Total Lines",          **total_counts,    "Total": t_all},
    ]

    return {"rows": rows, "columns": ["Metric"] + month_order + ["Total"]}
