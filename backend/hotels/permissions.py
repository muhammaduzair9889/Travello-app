"""
Custom permission classes for API security
"""
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework import status
from rest_framework.response import Response


class IsStaffUser(IsAuthenticated):
    """
    Permission to allow only staff/admin users
    """
    def has_permission(self, request, view):
        is_authenticated = super().has_permission(request, view)
        if not is_authenticated:
            return False
        return request.user.is_staff


class IsBookingOwnerOrStaff(BasePermission):
    """
    Permission to allow only booking owner or staff to view/modify booking
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access any booking
        if request.user and request.user.is_staff:
            return True
        # User can only access their own bookings
        return obj.user == request.user


class IsPaymentOwnerOrStaff(BasePermission):
    """
    Permission to allow only payment owner or staff to view payment
    """
    def has_object_permission(self, request, view, obj):
        # Admin can access any payment
        if request.user and request.user.is_staff:
            return True
        # User can only access their own booking's payment
        if hasattr(obj, 'booking'):
            return obj.booking.user == request.user
        return False


class IsHotelOwnerOrStaff(BasePermission):
    """
    Permission to allow only hotel owner or staff to modify hotel
    """
    def has_object_permission(self, request, view, obj):
        # Only staff can modify hotels
        if request.user and request.user.is_staff:
            return True
        return False


class CanManageHotels(BasePermission):
    """
    Permission to allow only staff users to create/update/delete hotels
    """
    def has_permission(self, request, view):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            # Allow anyone to view
            return True
        # Only staff can modify
        return request.user and request.user.is_staff


class CanAccessPayments(BasePermission):
    """
    Permission to allow only authenticated users to access payment endpoints
    but only for their own bookings
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
