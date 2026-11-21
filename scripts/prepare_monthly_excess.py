#!/usr/bin/env python3
"""Aggregate the excess trip time data by month and subway line."""

import csv
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "delayData.csv"
OUTPUT = ROOT / "data" / "monthlyExcessComponents.csv"
LINES = {"Red", "Orange", "Blue"}
FIELDS = (
    "est_pax",
    "weighted_trip_time",
    "weighted_bl_trip_time",
    "weighted_travel_time",
    "weighted_bl_travel_time",
    "weighted_wait_time",
    "weighted_bl_wait_time",
)


def main():
    totals = defaultdict(lambda: {field: Decimal(0) for field in FIELDS})

    with SOURCE.open(newline="", encoding="utf-8-sig") as source:
        reader = csv.DictReader(source)
        required = {"svc_date", "route_id", *FIELDS}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")

        for row_number, row in enumerate(reader, start=2):
            if row["route_id"] not in LINES:
                continue
            try:
                month = date.fromisoformat(row["svc_date"]).replace(day=1).isoformat()
                values = {field: Decimal(row[field]) for field in FIELDS}
                if not all(value.is_finite() for value in values.values()):
                    raise ValueError("non-finite numeric value")
            except (ValueError, InvalidOperation, TypeError) as error:
                raise ValueError(f"Invalid data on CSV row {row_number}: {error}") from error

            # Keep passenger and weighted-component sums for accurate range averages.
            for field, value in values.items():
                totals[(month, row["route_id"])][field] += value

    if not totals:
        raise ValueError("No Red, Orange, or Blue Line data found")
    for (month, line), values in totals.items():
        if values["est_pax"] <= 0:
            raise ValueError(f"Non-positive passenger total for {line} in {month}")

    with OUTPUT.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=("date", "line", *FIELDS), lineterminator="\n")
        writer.writeheader()
        for (month, line), values in sorted(totals.items()):
            writer.writerow({"date": month, "line": line, **values})

    print(f"Wrote {len(totals)} monthly line records to {OUTPUT}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, csv.Error) as error:
        print(f"Could not prepare monthly excess trip time data: {error}", file=sys.stderr)
        sys.exit(1)
