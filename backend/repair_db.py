import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

print("Connexion a PostgreSQL...")

conn = psycopg2.connect(
    host="localhost",
    port="5432",
    user="postgres",
    password="yasmin",
    database="postgres"
)
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

# Verifier les bases existantes
print("Bases existantes:")
cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false")
for row in cur.fetchall():
    print(f"  - '{row[0]}'")

# Renommer la base (enlever l'espace)
old_name = " Cevitalnew"
new_name = "Cevitalnew"

print(f"\nRenommage: '{old_name}' -> '{new_name}'")
cur.execute(f'ALTER DATABASE "{old_name}" RENAME TO "{new_name}"')
print("OK - Base renommee")

# Verifier si user existe
cur.execute("SELECT 1 FROM pg_roles WHERE rolname = 'cevital'")
if not cur.fetchone():
    print("Creation user cevital...")
    cur.execute("CREATE USER cevital WITH PASSWORD 'yasmin'")

# GRANT privileges sur la nouvelle base
print("Attribution privileges...")
cur.execute("GRANT CONNECT ON DATABASE Cevitalnew TO cevital")
cur.execute("GRANT USAGE ON SCHEMA public TO cevital")
cur.execute("GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cevital")
cur.execute("GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cevital")
cur.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO cevital")

print("\nTermine!")

cur.close()
conn.close()