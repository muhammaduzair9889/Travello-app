import os

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates a default admin user if it does not exist'

    def add_arguments(self, parser):
        parser.add_argument('--email', default=os.getenv('ADMIN_EMAIL', 'superadmin@travello.com'))
        parser.add_argument('--username', default=os.getenv('ADMIN_USERNAME', 'superadmin'))
        parser.add_argument('--password', default=os.getenv('ADMIN_PASSWORD'))

    def handle(self, *args, **options):
        email = options['email']
        username = options['username']
        password = options['password']

        if not password:
            raise CommandError(
                'Admin password must be provided via --password flag or ADMIN_PASSWORD env var.'
            )

        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'Admin user with email {email} already exists.')
            )
        else:
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created admin user: {email}')
            )