"""Diagnostic: check enum values in PostgreSQL."""
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    for enum_name in ("statutot", "statutvalidation", "typeot", "classeot"):
        print(f"--- {enum_name} ---")
        rows = conn.execute(text(f"""
            SELECT e.enumlabel
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = '{enum_name}'
            ORDER BY e.enumsortorder
        """)).fetchall()
        for r in rows:
            print(" -", r[0])
        print()
