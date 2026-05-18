import sys
sys.path.insert(0, '.')
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    cols = conn.execute(text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='ordres_travail' "
        "AND column_name IN ('priorite','urgence')"
    )).all()
    print('Colonnes presentes:')
    for c in cols:
        print(f"  {c[0]} ({c[1]})")
