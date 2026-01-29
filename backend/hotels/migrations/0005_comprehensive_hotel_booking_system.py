# Generated migration for comprehensive hotel booking system

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.core.validators
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('hotels', '0003_alter_booking_room_type'),
    ]

    operations = [
        # First, rename hotel_name to name
        migrations.RenameField(
            model_name='hotel',
            old_name='hotel_name',
            new_name='name',
        ),
        
        # Add new Hotel fields
        migrations.AddField(
            model_name='hotel',
            name='address',
            field=models.TextField(default='Unknown'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='hotel',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        
        # Remove old Hotel fields that are no longer needed
        migrations.RemoveField(
            model_name='hotel',
            name='location',
        ),
        migrations.RemoveField(
            model_name='hotel',
            name='total_rooms',
        ),
        migrations.RemoveField(
            model_name='hotel',
            name='available_rooms',
        ),
        migrations.RemoveField(
            model_name='hotel',
            name='single_bed_price_per_day',
        ),
        migrations.RemoveField(
            model_name='hotel',
            name='family_room_price_per_day',
        ),
        
        # Update Hotel field validators
        migrations.AlterField(
            model_name='hotel',
            name='rating',
            field=models.FloatField(default=0.0, validators=[django.core.validators.MinValueValidator(0.0)]),
        ),
        
        # Create RoomType model
        migrations.CreateModel(
            name='RoomType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('single', 'Single'), ('double', 'Double'), ('triple', 'Triple'), ('quad', 'Quad'), ('family', 'Family'), ('suite', 'Suite'), ('deluxe', 'Deluxe')], db_index=True, max_length=20)),
                ('price_per_night', models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('total_rooms', models.IntegerField(validators=[django.core.validators.MinValueValidator(1)])),
                ('max_occupancy', models.IntegerField(default=2, validators=[django.core.validators.MinValueValidator(1)])),
                ('description', models.TextField(blank=True)),
                ('amenities', models.TextField(blank=True, help_text='Comma-separated amenities (e.g., TV, Mini-bar, Balcony)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('hotel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='room_types', to='hotels.hotel')),
            ],
            options={
                'db_table': 'hotels_roomtype',
                'ordering': ['price_per_night'],
                'indexes': [models.Index(fields=['hotel', 'type'], name='hotels_roo_hotel_idx')],
            },
        ),
        
        # Add unique constraint to RoomType
        migrations.AddConstraint(
            model_name='roomtype',
            constraint=models.UniqueConstraint(fields=['hotel', 'type'], name='unique_hotel_roomtype'),
        ),
        
        # Update Booking model - change room_type from CharField to ForeignKey
        migrations.AlterField(
            model_name='booking',
            name='room_type',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='bookings', to='hotels.roomtype'),
        ),
        
        # Rename booking_date to created_at
        migrations.RenameField(
            model_name='booking',
            old_name='booking_date',
            new_name='created_at',
        ),
        
        # Rename check_in_date to check_in
        migrations.RenameField(
            model_name='booking',
            old_name='check_in_date',
            new_name='check_in',
        ),
        
        # Rename check_out_date to check_out
        migrations.RenameField(
            model_name='booking',
            old_name='check_out_date',
            new_name='check_out',
        ),
        
        # Update check_in field to allow null for migration
        migrations.AlterField(
            model_name='booking',
            name='check_in',
            field=models.DateField(db_index=True, null=True, blank=True),
        ),
        
        # Update check_out field to allow null for migration
        migrations.AlterField(
            model_name='booking',
            name='check_out',
            field=models.DateField(db_index=True, null=True, blank=True),
        ),
        
        # Add new Booking fields
        migrations.AddField(
            model_name='booking',
            name='payment_method',
            field=models.CharField(choices=[('ONLINE', 'Online Payment'), ('ARRIVAL', 'Pay on Arrival')], default='ONLINE', max_length=10),
        ),
        migrations.AddField(
            model_name='booking',
            name='status',
            field=models.CharField(choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('CONFIRMED', 'Confirmed'), ('CANCELLED', 'Cancelled'), ('COMPLETED', 'Completed')], db_index=True, default='PENDING', max_length=10),
        ),
        migrations.AddField(
            model_name='booking',
            name='guest_name',
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name='booking',
            name='guest_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='booking',
            name='guest_phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='booking',
            name='special_requests',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='booking',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        
        # Remove old payment_status field
        migrations.RemoveField(
            model_name='booking',
            name='payment_status',
        ),
        
        # Add indexes to Booking
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['user', 'status'], name='hotels_book_user_idx'),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['hotel', 'check_in'], name='hotels_book_hotel_idx'),
        ),
        migrations.AddIndex(
            model_name='booking',
            index=models.Index(fields=['status', 'created_at'], name='hotels_book_status_idx'),
        ),
        
        # Create Payment model
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stripe_payment_intent', models.CharField(blank=True, help_text='Stripe Payment Intent ID', max_length=255, null=True, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10, validators=[django.core.validators.MinValueValidator(Decimal('0.01'))])),
                ('currency', models.CharField(choices=[('USD', 'US Dollar'), ('EUR', 'Euro'), ('GBP', 'British Pound'), ('PKR', 'Pakistani Rupee')], default='USD', max_length=3)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('PROCESSING', 'Processing'), ('SUCCEEDED', 'Succeeded'), ('FAILED', 'Failed'), ('REFUNDED', 'Refunded'), ('CANCELLED', 'Cancelled')], db_index=True, default='PENDING', max_length=15)),
                ('payment_method_type', models.CharField(blank=True, help_text='e.g., card, bank_transfer', max_length=50)),
                ('last4', models.CharField(blank=True, help_text='Last 4 digits of card', max_length=4)),
                ('brand', models.CharField(blank=True, help_text='Card brand (Visa, Mastercard, etc.)', max_length=20)),
                ('error_message', models.TextField(blank=True)),
                ('metadata', models.JSONField(blank=True, default=dict, help_text='Additional payment metadata')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('booking', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='payment', to='hotels.booking')),
            ],
            options={
                'db_table': 'hotels_payment',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['status', 'created_at'], name='hotels_pay_status_idx'), models.Index(fields=['stripe_payment_intent'], name='hotels_pay_intent_idx')],
            },
        ),
    ]
