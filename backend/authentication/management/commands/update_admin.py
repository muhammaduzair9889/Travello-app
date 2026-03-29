from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Update or create admin user with provided email and password'

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True, help='Admin email')
        parser.add_argument('--password', type=str, required=True, help='Admin password')
        parser.add_argument('--username', type=str, default='admin', help='Admin username')

    def handle(self, *args, **options):
        User = get_user_model()
        email = options['email']
        password = options['password']
        username = options['username']

        user, created = User.objects.get_or_create(email=email, defaults={'username': username})
        if not created:
            # Update username if needed
            if getattr(user, 'username', None) != username:
                user.username = username
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f'Created admin user {email}'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Updated admin user {email}'))
