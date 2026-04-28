import time

from django.core.management.base import BaseCommand

from safety.services import escalate_pending_risks


class Command(BaseCommand):
    help = 'Background worker that escalates stale risk events to incidents.'

    def add_arguments(self, parser):
        parser.add_argument('--interval', type=int, default=10, help='Polling interval in seconds')

    def handle(self, *args, **options):
        interval = max(3, options['interval'])
        self.stdout.write(self.style.SUCCESS(f'Safety worker started (interval={interval}s)'))

        while True:
            escalated = escalate_pending_risks()
            if escalated:
                self.stdout.write(self.style.WARNING(f'Escalated {escalated} safety incidents'))
            time.sleep(interval)
