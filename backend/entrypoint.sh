#!/bin/bash
set -e

echo "=== Travello Backend Entrypoint ==="

# Wait for database to be ready (extra safety beyond depends_on healthcheck)
echo "Waiting for database..."
python -c "
import time, os, sys
for i in range(30):
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')
        django.setup()
        from django.db import connections
        connections['default'].ensure_connection()
        print('Database ready!')
        sys.exit(0)
    except Exception as e:
        print(f'  Attempt {i+1}/30: {e}')
        time.sleep(2)
print('Database not ready after 60s')
sys.exit(1)
"

# Run migrations automatically
echo "Running migrations..."
python manage.py migrate --noinput 2>&1 || echo "Migration warning (non-fatal)"

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput 2>&1 || echo "Collectstatic warning (non-fatal)"

echo "=== Starting Daphne (ASGI) ==="

# Execute the CMD (gunicorn)
exec "$@"
