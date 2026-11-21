#!/usr/bin/env python3
"""Prepare line-level monthly ridership into percent-of-2019 recovery data."""

import csv
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "mbtaMonthlyRidershipByModeLine.csv"
OUTPUT = ROOT / "data" / "ridershipRecovery.csv"
VIEW_B_START = date(2022, 1, 1)
VIEW_B_END = date(2026, 8, 1)
LINES = {
    "Red Line": "Red",
    "Orange Line": "Orange",
    "Blue Line": "Blue",
}
DAYTYPE_ROWS = {"Weekday", "Saturday", "Sunday"}


def parse_month(value):
    text = value.strip()
    try:
        if "/" in text[:10]:
            parts = text[:10].split("/")
            if len(parts[0]) == 4:
                parsed = date(int(parts[0]), int(parts[1]), int(parts[2]))
            else:
                parsed = date(int(parts[2]), int(parts[0]), int(parts[1]))
        else:
            parsed = date.fromisoformat(text[:10])
    except (ValueError, IndexError) as error:
        raise ValueError(f"Invalid month_of_service: {value!r}") from error
    return parsed.replace(day=1)


def parse_integer(value, description):
    try:
        number = Decimal(value.replace(",", "").strip())
    except (AttributeError, InvalidOperation) as error:
        raise ValueError(f"Invalid {description}: {value!r}") from error
    if not number.is_finite() or number != number.to_integral_value():
        raise ValueError(f"Invalid {description}: {value!r}")
    return int(number)


def main():
    totals = defaultdict(lambda: {"ridership_total": 0, "daycount": 0})
    seen_month_types = set()

    with SOURCE.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {
            "month_of_service",
            "daytype",
            "daycount",
            "route_or_line",
            "ridership_total",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")

        for row_number, row in enumerate(reader, start=2):
            if row["route_or_line"] not in LINES or row["daytype"] not in DAYTYPE_ROWS:
                continue
            month = parse_month(row["month_of_service"])
            line = LINES[row["route_or_line"]]
            ridership = parse_integer(row["ridership_total"], f"ridership_total on row {row_number}")
            daycount = parse_integer(row["daycount"], f"daycount on row {row_number}")
            if ridership < 0 or daycount < 0:
                raise ValueError(f"Negative ridership or daycount on row {row_number}")
            key = (month, line)
            totals[key]["ridership_total"] += ridership
            totals[key]["daycount"] += daycount
            seen_month_types.add((month, line, row["daytype"]))

    baselines = {}
    for month in range(1, 13):
        baseline_month = date(2019, month, 1)
        for line in LINES.values():
            key = (baseline_month, line)
            if key not in totals or totals[key]["daycount"] == 0:
                raise ValueError(f"Missing 2019 baseline for {line} in {baseline_month.strftime('%B')}")
            if any((baseline_month, line, daytype) not in seen_month_types for daytype in DAYTYPE_ROWS):
                raise ValueError(f"Incomplete 2019 daytype coverage for {line} in {baseline_month.strftime('%B')}")
            baselines[(line, month)] = (
                totals[key]["ridership_total"] / totals[key]["daycount"]
            )

    output_rows = []
    for (month, line), values in sorted(totals.items()):
        if month < VIEW_B_START or month > VIEW_B_END:
            continue
        if values["daycount"] == 0:
            raise ValueError(f"Zero daycount for {line} in {month.isoformat()}")
        if any((month, line, daytype) not in seen_month_types for daytype in DAYTYPE_ROWS):
            raise ValueError(f"Incomplete daytype coverage for {line} in {month.isoformat()}")
        avg_daily = values["ridership_total"] / values["daycount"]
        baseline = baselines[(line, month.month)]
        recovery = avg_daily / baseline * 100
        if baseline <= 0:
            raise ValueError(f"Non-positive 2019 baseline for {line} in {month.strftime('%B')}")
        output_rows.append({
            "date": month.isoformat(),
            "line": line,
            "avg_daily_ridership": f"{avg_daily:.6f}",
            "baseline_2019": f"{baseline:.6f}",
            "recovery_pct": f"{recovery:.6f}",
        })

    with OUTPUT.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=("date", "line", "avg_daily_ridership", "baseline_2019", "recovery_pct"),
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(output_rows)

    print(f"Wrote {len(output_rows)} monthly line records to {OUTPUT}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, csv.Error) as error:
        print(f"Could not prepare monthly ridership recovery data: {error}", file=sys.stderr)
        sys.exit(1)
