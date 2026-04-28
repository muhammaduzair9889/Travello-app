from django.apps import AppConfig
import os
import sys


class ItinerariesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'itineraries'

    def ready(self):
        """Warm up the ranker cache once at startup so first request is fast."""
        management_commands_to_skip = {
            'migrate',
            'makemigrations',
            'showmigrations',
            'check',
            'test',
            'shell',
            'dbshell',
            'collectstatic',
        }

        if os.environ.get('TRAVELLO_SKIP_HF_WARMUP') == '1':
            return

        if len(sys.argv) > 1 and sys.argv[1] in management_commands_to_skip:
            return

        try:
            from .hf_ranker import create_hf_ranker

            create_hf_ranker()
        except Exception:
            # Startup warmup is best-effort only; request-time fallback still works.
            pass

