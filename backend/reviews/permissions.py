from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsReviewOwnerOrReadOnly(BasePermission):
    """Allow owners to edit/delete their own reviews; everyone else read-only."""

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.user == request.user


class CanReplyToReview(BasePermission):
    """Only staff users can reply to reviews."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user and request.user.is_staff
