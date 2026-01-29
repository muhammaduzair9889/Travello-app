from django.contrib import admin
from django.utils.html import format_html
from .models import Hotel, RoomType, Booking, Payment


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ('name', 'city', 'rating', 'get_total_rooms', 'get_available_rooms', 'wifi_available', 'parking_available', 'created_at')
    list_filter = ('wifi_available', 'parking_available', 'city', 'rating')
    search_fields = ('name', 'city', 'address', 'description')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'get_total_rooms', 'get_available_rooms')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('name', 'city', 'address', 'description')
        }),
        ('Media & Rating', {
            'fields': ('image', 'rating')
        }),
        ('Amenities', {
            'fields': ('wifi_available', 'parking_available')
        }),
        ('Statistics', {
            'fields': ('get_total_rooms', 'get_available_rooms', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_total_rooms(self, obj):
        return obj.total_rooms
    get_total_rooms.short_description = 'Total Rooms'
    
    def get_available_rooms(self, obj):
        return obj.available_rooms
    get_available_rooms.short_description = 'Available Rooms'


class RoomTypeInline(admin.TabularInline):
    model = RoomType
    extra = 1
    fields = ('type', 'price_per_night', 'total_rooms', 'max_occupancy', 'amenities')


@admin.register(RoomType)
class RoomTypeAdmin(admin.ModelAdmin):
    list_display = ('hotel', 'type', 'price_per_night', 'total_rooms', 'get_available_rooms', 'max_occupancy')
    list_filter = ('type', 'hotel__city')
    search_fields = ('hotel__name', 'type', 'description')
    ordering = ('hotel', 'price_per_night')
    readonly_fields = ('created_at', 'updated_at', 'get_available_rooms')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('hotel', 'type', 'price_per_night')
        }),
        ('Capacity', {
            'fields': ('total_rooms', 'max_occupancy', 'get_available_rooms')
        }),
        ('Details', {
            'fields': ('description', 'amenities')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_available_rooms(self, obj):
        available = obj.available_rooms
        color = 'green' if available > 5 else 'orange' if available > 0 else 'red'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            available
        )
    get_available_rooms.short_description = 'Available'


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'user', 'hotel', 'room_type', 'rooms_booked', 
        'check_in', 'check_out', 'get_nights', 'total_price', 
        'payment_method', 'get_status', 'created_at'
    )
    list_filter = ('status', 'payment_method', 'check_in', 'check_out', 'created_at')
    search_fields = (
        'user__email', 'user__username', 'hotel__name', 
        'guest_name', 'guest_email', 'guest_phone'
    )
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'get_nights')
    date_hierarchy = 'check_in'
    
    fieldsets = (
        ('Booking Information', {
            'fields': ('user', 'hotel', 'room_type', 'rooms_booked')
        }),
        ('Stay Dates', {
            'fields': ('check_in', 'check_out', 'get_nights')
        }),
        ('Guest Information', {
            'fields': ('guest_name', 'guest_email', 'guest_phone', 'special_requests'),
            'classes': ('collapse',)
        }),
        ('Payment & Status', {
            'fields': ('total_price', 'payment_method', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['mark_as_confirmed', 'mark_as_cancelled', 'mark_as_completed']
    
    def get_nights(self, obj):
        return obj.number_of_nights
    get_nights.short_description = 'Nights'
    
    def get_status(self, obj):
        colors = {
            'PENDING': 'orange',
            'PAID': 'blue',
            'CONFIRMED': 'green',
            'CANCELLED': 'red',
            'COMPLETED': 'gray',
        }
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            colors.get(obj.status, 'black'),
            obj.get_status_display()
        )
    get_status.short_description = 'Status'
    
    def mark_as_confirmed(self, request, queryset):
        queryset.update(status='CONFIRMED')
    mark_as_confirmed.short_description = 'Mark as Confirmed'
    
    def mark_as_cancelled(self, request, queryset):
        queryset.update(status='CANCELLED')
    mark_as_cancelled.short_description = 'Mark as Cancelled'
    
    def mark_as_completed(self, request, queryset):
        queryset.update(status='COMPLETED')
    mark_as_completed.short_description = 'Mark as Completed'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'booking', 'amount', 'currency', 'get_status', 
        'stripe_payment_intent', 'payment_method_type', 'created_at'
    )
    list_filter = ('status', 'currency', 'payment_method_type', 'created_at')
    search_fields = (
        'booking__id', 'booking__user__email', 
        'stripe_payment_intent', 'last4'
    )
    ordering = ('-created_at',)
    readonly_fields = (
        'created_at', 'updated_at', 'stripe_payment_intent', 
        'last4', 'brand', 'payment_method_type'
    )
    
    fieldsets = (
        ('Booking Reference', {
            'fields': ('booking',)
        }),
        ('Payment Details', {
            'fields': ('amount', 'currency', 'status')
        }),
        ('Stripe Information', {
            'fields': (
                'stripe_payment_intent', 'payment_method_type', 
                'last4', 'brand'
            ),
            'classes': ('collapse',)
        }),
        ('Additional Info', {
            'fields': ('error_message', 'metadata'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_status(self, obj):
        colors = {
            'PENDING': 'orange',
            'PROCESSING': 'blue',
            'SUCCEEDED': 'green',
            'FAILED': 'red',
            'REFUNDED': 'purple',
            'CANCELLED': 'gray',
        }
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            colors.get(obj.status, 'black'),
            obj.get_status_display()
        )
    get_status.short_description = 'Status'


# Optionally add inline to Hotel admin
HotelAdmin.inlines = [RoomTypeInline]