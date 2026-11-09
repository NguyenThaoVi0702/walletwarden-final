import calendar
import re
from datetime import date

from fastapi import HTTPException


def current_month() -> str:
    return date.today().strftime("%Y-%m")


def month_bounds(month: str) -> tuple[date, date]:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=422, detail="month must use YYYY-MM")
    year, month_number = (int(part) for part in month.split("-"))
    try:
        start = date(year, month_number, 1)
    except ValueError:
        raise HTTPException(status_code=422, detail="invalid month") from None
    end = date(year, month_number, calendar.monthrange(year, month_number)[1])
    return start, end


def previous_month(month: str) -> str:
    year, month_number = (int(part) for part in month.split("-"))
    if month_number == 1:
        return f"{year - 1}-12"
    return f"{year}-{month_number - 1:02d}"
