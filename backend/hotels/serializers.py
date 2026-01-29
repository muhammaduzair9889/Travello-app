from rest_framework import serializers
from django.utils import timezone
from .models import Hotel, RoomType, Booking, Payment
from authentication.serializers import UserSerializer


class RoomTypeSerializer(serializers.ModelSerializer):
    """Read serializer for RoomType model"""
    available_rooms = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = RoomType
        fields = [
            'id', 'hotel', 'type', 'price_per_night', 'total_rooms', 
            'available_rooms', 'max_occupancy', 'description', 
            'amenities', 'created_at', 'updated_at'
        ]
        read_only_fields = ('created_at', 'updated_at')


class RoomTypeWriteSerializer(serializers.ModelSerializer):
    """Write serializer for nested room type creation/update"""

    class Meta:
        model = RoomType
        fields = [
            'type', 'price_per_night', 'total_rooms',
            'max_occupancy', 'description', 'amenities'
        ]


class HotelSerializer(serializers.ModelSerializer):
    """Serializer for Hotel model with room types"""
    room_types = RoomTypeSerializer(many=True, read_only=True)
    room_types_payload = RoomTypeWriteSerializer(many=True, write_only=True, required=False)
    total_rooms = serializers.IntegerField(read_only=True)
    available_rooms = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Hotel
        fields = [
            'id', 'name', 'city', 'address', 'description', 'image', 
            'rating', 'wifi_available', 'parking_available', 
            'room_types', 'room_types_payload', 'total_rooms', 'available_rooms',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('created_at', 'updated_at', 'total_rooms', 'available_rooms')

    def _upsert_room_types(self, hotel, room_types_data):
        # Remove existing types and recreate for simplicity
        hotel.room_types.all().delete()
        room_type_objs = []
        for rt in room_types_data:
            room_type_objs.append(RoomType(
                hotel=hotel,
                type=rt['type'],
                price_per_night=rt['price_per_night'],
                total_rooms=rt['total_rooms'],
                max_occupancy=rt.get('max_occupancy', 2),
                description=rt.get('description', ''),
                amenities=rt.get('amenities', ''),
            ))
        if room_type_objs:
            RoomType.objects.bulk_create(room_type_objs)

    def create(self, validated_data):
        room_types_data = validated_data.pop('room_types_payload', [])
        hotel = super().create(validated_data)
        if room_types_data:
            self._upsert_room_types(hotel, room_types_data)
        return hotel

    def update(self, instance, validated_data):
        room_types_data = validated_data.pop('room_types_payload', None)
        hotel = super().update(instance, validated_data)
        if room_types_data is not None:
            self._upsert_room_types(hotel, room_types_data)
        return hotel


class HotelListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for hotel listings"""
    min_price = serializers.SerializerMethodField()
    total_rooms = serializers.IntegerField(read_only=True)
    available_rooms = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Hotel
        fields = [
            'id', 'name', 'city', 'address', 'image', 'rating',
            'wifi_available', 'parking_available', 'min_price',
            'total_rooms', 'available_rooms'
        ]
    
    def get_min_price(self, obj):
        """Get minimum room price"""
        room_types = obj.room_types.all()
        if room_types:
            return min(rt.price_per_night for rt in room_types)
        return None


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for Payment model"""
    is_successful = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Payment
        fields = [
            'id', 'booking', 'stripe_payment_intent', 'amount', 
            'currency', 'status', 'payment_method_type', 'last4', 
            'brand', 'error_message', 'is_successful', 
            'created_at', 'updated_at'
        ]
        read_only_fields = (
            'created_at', 'updated_at', 'stripe_payment_intent',
            'last4', 'brand', 'payment_method_type'
        )


class BookingSerializer(serializers.ModelSerializer):
    """Full serializer for Booking model"""
    hotel_details = HotelSerializer(source='hotel', read_only=True)
    room_type_details = RoomTypeSerializer(source='room_type', read_only=True)
    user_details = UserSerializer(source='user', read_only=True)
    payment = PaymentSerializer(read_only=True)
    number_of_nights = serializers.IntegerField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    is_past = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'id', 'user', 'hotel', 'room_type', 'rooms_booked',
            'check_in', 'check_out', 'total_price', 'payment_method',
            'status', 'guest_name', 'guest_email', 'guest_phone',
            'special_requests', 'number_of_nights', 'is_active', 'is_past',
            'hotel_details', 'room_type_details', 'user_details', 'payment',
            'created_at', 'updated_at'
        ]
        read_only_fields = ('created_at', 'updated_at', 'user')


class BookingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating bookings with comprehensive validation"""
    available_rooms = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'hotel', 'room_type', 'rooms_booked', 'check_in', 'check_out',
            'payment_method', 'guest_name', 'guest_email', 'guest_phone',
            'special_requests', 'available_rooms'
        ]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make guest fields optional - they can be left blank if user details exist
        self.fields['guest_name'].required = False
        self.fields['guest_email'].required = False
        self.fields['guest_phone'].required = False
        self.fields['special_requests'].required = False
    
    def get_available_rooms(self, obj):
        """Get available rooms for the selected dates"""
        if obj.room_type and obj.check_in and obj.check_out:
            return obj.room_type.get_available_rooms(obj.check_in, obj.check_out)
        return None
    
    def validate(self, attrs):
        """
        Comprehensive validation to prevent overbooking.
        
        Implements the rule:
        A room is unavailable if:
        - check_in < selected_check_out
        - AND check_out > selected_check_in
        - AND status IN (PENDING, PAID, CONFIRMED)
        """
        room_type = attrs.get('room_type')
        hotel = attrs.get('hotel')
        rooms_booked = attrs.get('rooms_booked')
        check_in = attrs.get('check_in')
        check_out = attrs.get('check_out')
        
        # Validate room type belongs to hotel
        if room_type and hotel and room_type.hotel != hotel:
            raise serializers.ValidationError({
                'room_type': 'Selected room type does not belong to this hotel.'
            })
        
        # Validate dates
        if check_in and check_out:
            if check_out <= check_in:
                raise serializers.ValidationError({
                    'check_out': 'Check-out date must be after check-in date.'
                })
            
            # Validate check-in is not in the past
            if check_in < timezone.now().date():
                raise serializers.ValidationError({
                    'check_in': 'Check-in date cannot be in the past.'
                })
            
            # Validate maximum stay duration (e.g., 30 days)
            max_stay_days = 30
            stay_duration = (check_out - check_in).days
            if stay_duration > max_stay_days:
                raise serializers.ValidationError({
                    'check_out': f'Maximum stay duration is {max_stay_days} days. Your stay is {stay_duration} days.'
                })
        
        # Validate room availability using the comprehensive logic
        if room_type and check_in and check_out and rooms_booked:
            # Get available rooms using the overlapping logic
            available = room_type.get_available_rooms(check_in, check_out)
            
            if rooms_booked > available:
                # Provide detailed error message
                raise serializers.ValidationError({
                    'rooms_booked': (
                        f'Only {available} {room_type.get_type_display()} room(s) available '
                        f'from {check_in.strftime("%Y-%m-%d")} to {check_out.strftime("%Y-%m-%d")}. '
                        f'You requested {rooms_booked} room(s).'
                    )
                })
            
            # Validate doesn't exceed total rooms
            if rooms_booked > room_type.total_rooms:
                raise serializers.ValidationError({
                    'rooms_booked': f'Cannot book more than {room_type.total_rooms} rooms of this type.'
                })
            
            # Validate positive number
            if rooms_booked < 1:
                raise serializers.ValidationError({
                    'rooms_booked': 'Must book at least 1 room.'
                })
        
        return attrs
    
    def create(self, validated_data):
        """
        Create booking with automatic price calculation and availability check.
        Uses transaction to prevent race conditions.
        """
        from django.db import transaction
        
        room_type = validated_data['room_type']
        check_in = validated_data['check_in']
        check_out = validated_data['check_out']
        rooms_booked = validated_data['rooms_booked']
        
        # Calculate total price
        nights = (check_out - check_in).days
        total_price = room_type.price_per_night * nights * rooms_booked
        
        validated_data['total_price'] = total_price
        validated_data['status'] = 'PENDING'
        
        # Use atomic transaction to prevent race conditions during booking
        with transaction.atomic():
            # Double-check availability within transaction
            available = room_type.get_available_rooms(check_in, check_out)
            
            if rooms_booked > available:
                raise serializers.ValidationError({
                    'rooms_booked': (
                        f'Room availability changed. Only {available} rooms now available. '
                        f'Please try again.'
                    )
                })
            
            # Create the booking
            booking = super().create(validated_data)
        
        return booking


class BookingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for booking lists"""
    hotel_name = serializers.CharField(source='hotel.name', read_only=True)
    room_type_name = serializers.CharField(source='room_type.get_type_display', read_only=True)
    number_of_nights = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'id', 'hotel_name', 'room_type_name', 'rooms_booked',
            'check_in', 'check_out', 'number_of_nights', 'total_price',
            'payment_method', 'status', 'created_at'
        ]


class BookingPreviewSerializer(serializers.Serializer):
    """Serializer for previewing booking details without creating"""
    hotel_id = serializers.IntegerField(required=True)
    room_type_id = serializers.IntegerField(required=True)
    check_in = serializers.DateField(required=True)
    check_out = serializers.DateField(required=True)
    rooms_booked = serializers.IntegerField(required=False, default=1, min_value=1)
    
    def validate(self, attrs):
        """Validate preview request"""
        check_in = attrs['check_in']
        check_out = attrs['check_out']
        
        # Validate date order
        if check_out <= check_in:
            raise serializers.ValidationError({
                'check_out': 'Check-out date must be after check-in date.'
            })
        
        # Validate check-in is not in the past
        if check_in < timezone.now().date():
            raise serializers.ValidationError({
                'check_in': 'Check-in date cannot be in the past.'
            })
        
        # Validate hotel exists
        try:
            hotel = Hotel.objects.get(id=attrs['hotel_id'])
            attrs['hotel'] = hotel
        except Hotel.DoesNotExist:
            raise serializers.ValidationError({
                'hotel_id': 'Hotel not found.'
            })
        
        # Validate room type exists and belongs to hotel
        try:
            room_type = RoomType.objects.get(id=attrs['room_type_id'], hotel=hotel)
            attrs['room_type'] = room_type
        except RoomType.DoesNotExist:
            raise serializers.ValidationError({
                'room_type_id': 'Room type not found for this hotel.'
            })
        
        return attrs
    
    def get_preview_data(self):
        """Generate booking preview data"""
        room_type = self.validated_data['room_type']
        check_in = self.validated_data['check_in']
        check_out = self.validated_data['check_out']
        rooms_booked = self.validated_data.get('rooms_booked', 1)
        
        # Calculate nights and prices
        nights = (check_out - check_in).days
        price_per_night = float(room_type.price_per_night)
        total_price = price_per_night * nights * rooms_booked
        
        # Check availability
        available_rooms = room_type.get_available_rooms(check_in, check_out)
        is_available = available_rooms >= rooms_booked
        
        return {
            'hotel_id': self.validated_data['hotel'].id,
            'hotel_name': self.validated_data['hotel'].name,
            'room_type_id': room_type.id,
            'room_type': room_type.get_type_display(),
            'check_in': check_in,
            'check_out': check_out,
            'nights': nights,
            'rooms_booked': rooms_booked,
            'price_per_night': price_per_night,
            'total_price': total_price,
            'available_rooms': available_rooms,
            'is_available': is_available,
            'availability_status': 'AVAILABLE' if is_available else 'NOT_AVAILABLE',
            'message': f'{available_rooms} room(s) available' if is_available else f'Only {available_rooms} room(s) available, you requested {rooms_booked}'
        }


class RoomTypeDetailSerializer(serializers.ModelSerializer):
    """Detailed room type serializer with booking information"""
    available_rooms = serializers.SerializerMethodField()
    booked_rooms = serializers.SerializerMethodField()
    
    class Meta:
        model = RoomType
        fields = [
            'id', 'type', 'price_per_night', 'total_rooms', 
            'available_rooms', 'booked_rooms', 'max_occupancy', 
            'description', 'amenities'
        ]
    
    def get_available_rooms(self, obj):
        """Get currently available rooms"""
        return obj.get_available_rooms()
    
    def get_booked_rooms(self, obj):
        """Get list of booked rooms with checkout dates"""
        from django.db.models import Q
        
        # Get active bookings for this room type
        active_bookings = Booking.objects.filter(
            room_type=obj,
            status__in=['PENDING', 'PAID', 'CONFIRMED'],
            check_out__gte=timezone.now().date()
        ).values('id', 'rooms_booked', 'check_in', 'check_out', 'status')
        
        return list(active_bookings)


class BookingUpdateSerializer(serializers.ModelSerializer):
    """Serializer for admin updating booking status"""
    
    class Meta:
        model = Booking
        fields = ['status', 'special_requests']
    
    def validate_status(self, value):
        """Validate status transitions"""
        if self.instance:
            current_status = self.instance.status
            
            # Define allowed transitions
            allowed_transitions = {
                'PENDING': ['PAID', 'CONFIRMED', 'CANCELLED'],
                'PAID': ['CONFIRMED', 'CANCELLED'],
                'CONFIRMED': ['COMPLETED', 'CANCELLED'],
                'CANCELLED': [],  # Cannot transition from cancelled
                'COMPLETED': []   # Cannot transition from completed
            }
            
            if value not in allowed_transitions.get(current_status, []):
                raise serializers.ValidationError(
                    f'Cannot change status from {current_status} to {value}'
                )
        
        return value


class AvailabilityCheckSerializer(serializers.Serializer):
    """Serializer for checking room availability"""
    hotel = serializers.IntegerField(required=True, help_text="Hotel ID")
    room_type = serializers.IntegerField(required=False, help_text="Room Type ID (optional)")
    check_in = serializers.DateField(required=True, help_text="Check-in date (YYYY-MM-DD)")
    check_out = serializers.DateField(required=True, help_text="Check-out date (YYYY-MM-DD)")
    rooms_needed = serializers.IntegerField(required=False, default=1, min_value=1)
    
    def validate(self, attrs):
        """Validate availability check request"""
        check_in = attrs['check_in']
        check_out = attrs['check_out']
        
        # Validate date order
        if check_out <= check_in:
            raise serializers.ValidationError({
                'check_out': 'Check-out date must be after check-in date.'
            })
        
        # Validate check-in is not in the past
        from django.utils import timezone
        if check_in < timezone.now().date():
            raise serializers.ValidationError({
                'check_in': 'Check-in date cannot be in the past.'
            })
        
        # Validate hotel exists
        try:
            hotel = Hotel.objects.get(id=attrs['hotel'])
            attrs['hotel_obj'] = hotel
        except Hotel.DoesNotExist:
            raise serializers.ValidationError({
                'hotel': 'Hotel not found.'
            })
        
        # Validate room type if provided
        if 'room_type' in attrs and attrs['room_type']:
            try:
                room_type = RoomType.objects.get(id=attrs['room_type'], hotel=hotel)
                attrs['room_type_obj'] = room_type
            except RoomType.DoesNotExist:
                raise serializers.ValidationError({
                    'room_type': 'Room type not found for this hotel.'
                })
        
        return attrs
    
    def get_availability(self):
        """Get availability information based on validated data"""
        hotel = self.validated_data['hotel_obj']
        check_in = self.validated_data['check_in']
        check_out = self.validated_data['check_out']
        rooms_needed = self.validated_data.get('rooms_needed', 1)
        
        # If specific room type requested
        if 'room_type_obj' in self.validated_data:
            room_type = self.validated_data['room_type_obj']
            available = room_type.get_available_rooms(check_in, check_out)
            nights = (check_out - check_in).days
            
            return {
                'hotel_id': hotel.id,
                'hotel_name': hotel.name,
                'check_in': check_in,
                'check_out': check_out,
                'nights': nights,
                'room_type': {
                    'id': room_type.id,
                    'type': room_type.type,
                    'type_display': room_type.get_type_display(),
                    'price_per_night': float(room_type.price_per_night),
                    'total_rooms': room_type.total_rooms,
                    'available_rooms': available,
                    'is_available': available >= rooms_needed,
                    'total_price': float(room_type.price_per_night * nights * rooms_needed),
                }
            }
        
        # Otherwise, return availability for all room types
        availability_data = RoomType.check_availability_for_hotel(hotel, check_in, check_out)
        nights = (check_out - check_in).days
        
        # Format the response
        room_types = []
        for room_id, info in availability_data.items():
            room_types.append({
                'id': room_id,
                'type': info['type'],
                'type_display': info['type_display'],
                'price_per_night': float(info['price_per_night']),
                'total_rooms': info['total_rooms'],
                'available_rooms': info['available_rooms'],
                'is_available': info['available_rooms'] >= rooms_needed,
                'total_price': float(info['price_per_night'] * nights * rooms_needed),
            })
        
        return {
            'hotel_id': hotel.id,
            'hotel_name': hotel.name,
            'check_in': check_in,
            'check_out': check_out,
            'nights': nights,
            'rooms_needed': rooms_needed,
            'room_types': room_types,
            'has_availability': any(rt['is_available'] for rt in room_types),
        }