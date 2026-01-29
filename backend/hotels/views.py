from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import APIException
from django.db import transaction
from django.db.models import Q
from .models import Hotel, Booking, RoomType
from django.utils.dateparse import parse_date
from .serializers import (
    HotelSerializer, BookingSerializer, BookingCreateSerializer,
    AvailabilityCheckSerializer, RoomTypeSerializer, BookingPreviewSerializer,
    RoomTypeDetailSerializer, BookingUpdateSerializer, BookingListSerializer
)
from .api_serializers import HotelSearchSerializer
from .services import hotel_api_service
from .permissions import IsStaffUser, IsBookingOwnerOrStaff, CanManageHotels
from travello_backend.utils import get_safe_error_response
import logging

logger = logging.getLogger(__name__)


class HotelViewSet(viewsets.ModelViewSet):
    queryset = Hotel.objects.all()
    serializer_class = HotelSerializer
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsStaffUser]
        else:
            permission_classes = [AllowAny]  # Allow anyone to view hotels
        return [permission() for permission in permission_classes]
    
    def create(self, request, *args, **kwargs):
        """Create a new hotel with better error handling"""
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as e:
            logger.error(f"Error creating hotel: {str(e)}")
            return get_safe_error_response(
                'Failed to create hotel',
                status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'], url_path='rooms')
    def get_rooms(self, request, pk=None):
        """
        GET /api/hotels/{id}/rooms/
        Returns room types with total_rooms, available_rooms, and booked rooms with checkout dates
        """
        hotel = self.get_object()
        room_types = hotel.room_types.all()
        
        serializer = RoomTypeDetailSerializer(room_types, many=True)
        
        return Response({
            'hotel_id': hotel.id,
            'hotel_name': hotel.name,
            'room_types': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Search hotels by city, location or name"""
        query = request.query_params.get('q', '')
        city = request.query_params.get('city', '')
        
        hotels = Hotel.objects.all()
        
        if city:
            hotels = hotels.filter(city__icontains=city)
        
        if query:
            hotels = hotels.filter(
                name__icontains=query
            ) | hotels.filter(
                address__icontains=query
            ) | hotels.filter(
                city__icontains=query
            )
        
        serializer = self.get_serializer(hotels, many=True)
        return Response(serializer.data)


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Users can only see their own bookings, admins see all"""
        if self.request.user.is_staff:
            return Booking.objects.all().select_related('hotel', 'room_type', 'user').order_by('-created_at')
        return Booking.objects.filter(user=self.request.user).select_related('hotel', 'room_type').order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return BookingCreateSerializer
        elif self.action in ['update', 'partial_update'] and self.request.user.is_staff:
            return BookingUpdateSerializer
        elif self.action == 'list':
            return BookingListSerializer
        return BookingSerializer
    
    def get_permissions(self):
        """Admin-only actions require staff permissions"""
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsStaffUser()]
        return [IsAuthenticated()]
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        POST /api/bookings/create/
        Create a new booking with payment method handling:
        - ARRIVAL: Create booking with status=PENDING
        - ONLINE: Create temporary booking for payment processing
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Get payment method
        payment_method = serializer.validated_data.get('payment_method', 'ONLINE')
        
        # Auto-populate guest info from user if not provided
        if not serializer.validated_data.get('guest_email'):
            serializer.validated_data['guest_email'] = request.user.email
        if not serializer.validated_data.get('guest_name'):
            serializer.validated_data['guest_name'] = request.user.get_full_name() or request.user.username
        
        # Set the user to the current logged-in user
        booking = serializer.save(user=request.user)
        
        # Handle different payment methods
        if payment_method == 'ARRIVAL':
            # Pay on arrival - booking is PENDING until they arrive
            booking.status = 'PENDING'
            booking.save()
            
            logger.info(f"Booking {booking.id} created with ARRIVAL payment method - status: PENDING")
        
        elif payment_method == 'ONLINE':
            # Online payment - booking stays PENDING until payment confirmed
            booking.status = 'PENDING'
            booking.save()
            
            logger.info(f"Booking {booking.id} created with ONLINE payment method - awaiting payment")
        
        # Return full booking details
        response_serializer = BookingSerializer(booking)
        return Response({
            'success': True,
            'message': 'Booking created successfully',
            'booking': response_serializer.data,
            'payment_required': payment_method == 'ONLINE',
            'booking_id': booking.id
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        """
        PATCH /api/admin/bookings/{id}/
        Admin only - Update booking status (COMPLETED, CANCELLED, etc.)
        """
        booking = self.get_object()
        serializer = self.get_serializer(booking, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        logger.info(f"Booking {booking.id} updated by admin {request.user.username}")
        
        response_serializer = BookingSerializer(booking)
        return Response({
            'success': True,
            'message': 'Booking updated successfully',
            'booking': response_serializer.data
        })
    
    @action(detail=False, methods=['get'], url_path='user')
    def user_bookings(self, request):
        """
        GET /api/user/bookings/
        Returns logged-in user's bookings
        """
        bookings = Booking.objects.filter(user=request.user).select_related('hotel', 'room_type').order_by('-created_at')
        serializer = BookingListSerializer(bookings, many=True)
        
        return Response({
            'success': True,
            'count': bookings.count(),
            'bookings': serializer.data
        })
    
    @action(detail=False, methods=['get'], url_path='admin')
    def admin_bookings(self, request):
        """
        GET /api/bookings/admin/
        Admin only - Returns all bookings with filters
        """
        # Check if user is staff - use permission class
        if not request.user.is_staff:
            logger.warning(f"Unauthorized admin booking access attempt by user {request.user.id}")
            return get_safe_error_response(
                'Access denied',
                status.HTTP_403_FORBIDDEN
            )
        
        try:
            bookings = Booking.objects.all().select_related('hotel', 'room_type', 'user').order_by('-created_at')
            
            # Apply filters
            status_filter = request.query_params.get('status')
            hotel_filter = request.query_params.get('hotel')
            payment_method_filter = request.query_params.get('payment_method')
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
            user_query = request.query_params.get('user')
            
            if status_filter:
                bookings = bookings.filter(status=status_filter)
            if hotel_filter:
                bookings = bookings.filter(hotel_id=hotel_filter)
            if payment_method_filter:
                bookings = bookings.filter(payment_method=payment_method_filter)
            # Filter by user name/email or guest name
            if user_query:
                bookings = bookings.filter(
                    Q(guest_name__icontains=user_query) |
                    Q(user__username__icontains=user_query) |
                    Q(user__email__icontains=user_query) |
                    Q(user__first_name__icontains=user_query) |
                    Q(user__last_name__icontains=user_query)
                )

            # Date range filters (check-in >= start_date, check-out <= end_date)
            if start_date_str:
                start_date = parse_date(start_date_str)
                if not start_date:
                    return get_safe_error_response(
                        'Invalid start_date. Use YYYY-MM-DD format.',
                        status.HTTP_400_BAD_REQUEST
                    )
                bookings = bookings.filter(check_in__gte=start_date)

            if end_date_str:
                end_date = parse_date(end_date_str)
                if not end_date:
                    return get_safe_error_response(
                        'Invalid end_date. Use YYYY-MM-DD format.',
                        status.HTTP_400_BAD_REQUEST
                    )
                bookings = bookings.filter(check_out__lte=end_date)
            
            serializer = BookingSerializer(bookings, many=True)
            
            return Response({
                'success': True,
                'count': bookings.count(),
                'bookings': serializer.data
            })
        except Exception as e:
            logger.error(f"Error retrieving admin bookings: {str(e)}")
            return get_safe_error_response(
                'Error retrieving bookings',
                status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def confirm_payment(self, request, pk=None):
        """Confirm payment and update booking status to PAID"""
        booking = self.get_object()
        
        if booking.status == 'PAID':
            return Response(
                {'error': 'Payment already confirmed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update booking status to PAID
        booking.status = 'PAID'
        booking.save()
        
        logger.info(f"Payment confirmed for booking {booking.id}")
        
        serializer = BookingSerializer(booking)
        return Response({
            'success': True,
            'message': 'Payment confirmed successfully',
            'booking': serializer.data
        })
    
    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """
        POST /api/bookings/{id}/cancel/
        Cancel a booking (user can cancel own PENDING bookings)
        """
        booking = self.get_object()
        
        # Verify user ownership
        if booking.user != request.user and not request.user.is_staff:
            return Response(
                {'error': 'You do not have permission to cancel this booking'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only allow cancellation of PENDING bookings
        if booking.status != 'PENDING':
            return Response(
                {'error': f'Cannot cancel booking with status: {booking.status}. Only PENDING bookings can be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update status to CANCELLED
        booking.status = 'CANCELLED'
        booking.save()
        
        logger.info(f"Booking {booking.id} cancelled by user {request.user.email}")
        
        serializer = BookingSerializer(booking)
        return Response({
            'success': True,
            'message': 'Booking cancelled successfully',
            'booking': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def my_bookings(self, request):
        """Get current user's bookings (legacy endpoint)"""
        try:
            bookings = Booking.objects.filter(
                user=request.user
            ).select_related(
                'hotel', 'room_type', 'user'
            ).prefetch_related(
                'payment'
            ).order_by('-created_at')
            
            serializer = BookingSerializer(bookings, many=True)
            logger.info(f"Retrieved {bookings.count()} bookings for user {request.user.email}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error fetching bookings for user {request.user.email}: {str(e)}")
            return get_safe_error_response(
                'Failed to fetch bookings',
                status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def cancel(self, request, pk=None):
        """Cancel a booking if owned by the user and not started yet"""
        booking = self.get_object()
        # Only booking owner or staff can cancel
        if booking.user != request.user and not request.user.is_staff:
            return Response({'error': 'You do not have permission to cancel this booking'}, status=status.HTTP_403_FORBIDDEN)
        # Prevent cancel if already cancelled or completed
        if booking.status in ['CANCELLED', 'COMPLETED']:
            return Response({'error': f'Cannot cancel a {booking.status.lower()} booking'}, status=status.HTTP_400_BAD_REQUEST)
        # Optional: prevent cancel on/after check-in date
        from django.utils import timezone
        if booking.check_in <= timezone.now().date():
            return Response({'error': 'Cannot cancel on or after check-in date'}, status=status.HTTP_400_BAD_REQUEST)
        # Update status
        booking.status = 'CANCELLED'
        booking.save()
        serializer = BookingSerializer(booking)
        return Response({'success': True, 'message': 'Booking cancelled', 'booking': serializer.data})


class RealTimeHotelSearchView(APIView):
    """
    Real-time hotel search API for Lahore, Pakistan
    POST /api/hotels/search-live/
    
    Integrates with Booking.com RapidAPI to fetch live hotel data
    """
    authentication_classes = []  # Disable authentication
    permission_classes = [AllowAny]  # Allow unauthenticated access for hotel search
    
    def post(self, request):
        """
        Search for hotels in Lahore with real-time data
        
        Request Body:
        {
            "check_in": "2025-12-15",
            "check_out": "2025-12-18",
            "adults": 2,
            "children": 1,
            "infants": 0,
            "room_type": "double"
        }
        
        Response:
        {
            "success": true,
            "count": 15,
            "destination": "Lahore, Pakistan",
            "hotels": [...]
        }
        """
        
        # Validate input
        serializer = HotelSearchSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid search parameters: {serializer.errors}")
            return Response(
                {
                    'success': False,
                    'error': 'Invalid search parameters',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Extract validated data
        validated_data = serializer.validated_data
        check_in = validated_data['check_in'].strftime('%Y-%m-%d')
        check_out = validated_data['check_out'].strftime('%Y-%m-%d')
        adults = validated_data['adults']
        children = validated_data.get('children', 0)
        room_type = validated_data.get('room_type', 'double')
        
        logger.info(f"Hotel search request: {check_in} to {check_out}, {adults} adults, {children} children, {room_type} room")
        
        try:
            # Call hotel API service
            hotels = hotel_api_service.search_lahore_hotels(
                check_in=check_in,
                check_out=check_out,
                adults=adults,
                children=children,
                room_type=room_type
            )
            
            logger.info(f"Successfully fetched {len(hotels)} hotels from API")
            logger.info(f"Hotel IDs: {[h.get('id', 'N/A') for h in hotels[:5]]}")
            
            # Always return hotels array, even if empty
            hotels_list = hotels if hotels else []
            
            logger.info(f"Returning response with {len(hotels_list)} hotels")
            
            # Return success even if no hotels found (valid scenario)
            return Response(
                {
                    'success': True,
                    'count': len(hotels_list),
                    'destination': 'Lahore, Pakistan',
                    'search_params': {
                        'check_in': check_in,
                        'check_out': check_out,
                        'adults': adults,
                        'children': children,
                        'room_type': room_type
                    },
                    'hotels': hotels_list
                },
                status=status.HTTP_200_OK
            )
        
        except APIException as e:
            # Handle API-specific errors
            logger.error(f"Hotel API error: {str(e)}")
            return Response(
                {
                    'success': False,
                    'error': 'Hotel search service error',
                    'message': str(e),
                    'hotels': []
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        except Exception as e:
            # Handle unexpected errors
            logger.error(f"Hotel search failed: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': 'Failed to fetch hotel data',
                    'message': f'An error occurred: {str(e)}',
                    'hotels': []
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BookingPreviewView(APIView):
    """
    POST /api/bookings/preview/
    Preview booking details without creating a booking
    
    Input: hotel_id, room_type_id, check_in, check_out, rooms_booked
    Output: nights, price_per_night, total_price, availability status
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Generate booking preview"""
        serializer = BookingPreviewSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid booking preview request: {serializer.errors}")
            return Response(
                {
                    'success': False,
                    'error': 'Invalid request parameters',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get preview data
            preview = serializer.get_preview_data()
            
            logger.info(
                f"Booking preview: Hotel {preview['hotel_id']}, "
                f"Room {preview['room_type_id']}, "
                f"{preview['check_in']} to {preview['check_out']}, "
                f"Total: {preview['total_price']}"
            )
            
            return Response(
                {
                    'success': True,
                    'preview': preview
                },
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Booking preview failed: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': 'Failed to generate booking preview',
                    'message': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RoomAvailabilityView(APIView):
    """
    Check room availability for specific dates.
    
    Prevents overbooking by implementing the rule:
    A room is unavailable if:
    - check_in < selected_check_out
    - AND check_out > selected_check_in
    - AND status IN (PENDING, PAID, CONFIRMED)
    
    POST /api/hotels/check-availability/
    
    Request Body:
    {
        "hotel": 1,
        "room_type": 2,  // Optional - if not provided, checks all room types
        "check_in": "2026-02-01",
        "check_out": "2026-02-05",
        "rooms_needed": 2  // Optional, defaults to 1
    }
    
    Response:
    {
        "hotel_id": 1,
        "hotel_name": "Grand Hotel",
        "check_in": "2026-02-01",
        "check_out": "2026-02-05",
        "nights": 4,
        "room_types": [
            {
                "id": 2,
                "type": "double",
                "type_display": "Double",
                "price_per_night": 75.00,
                "total_rooms": 10,
                "available_rooms": 8,
                "is_available": true,
                "total_price": 600.00
            }
        ],
        "has_availability": true
    }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        """Check room availability for the specified dates"""
        serializer = AvailabilityCheckSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"Invalid availability check request: {serializer.errors}")
            return Response(
                {
                    'success': False,
                    'error': 'Invalid request parameters',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get availability data
            availability = serializer.get_availability()
            
            logger.info(
                f"Availability check: Hotel {availability.get('hotel_id')}, "
                f"{availability.get('check_in')} to {availability.get('check_out')}"
            )
            
            return Response(
                {
                    'success': True,
                    'data': availability
                },
                status=status.HTTP_200_OK
            )
        
        except Exception as e:
            logger.error(f"Availability check failed: {str(e)}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': 'Failed to check availability',
                    'message': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )