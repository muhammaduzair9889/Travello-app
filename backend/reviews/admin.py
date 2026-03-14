from django.contrib import admin
from .models import Review, ReviewPhoto, ReviewHelpful, ReviewReply


class ReviewPhotoInline(admin.TabularInline):
    model = ReviewPhoto
    extra = 0


class ReviewReplyInline(admin.StackedInline):
    model = ReviewReply
    extra = 0


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ('user', 'hotel', 'overall_rating', 'sentiment', 'status', 'helpful_count', 'created_at')
    list_filter = ('status', 'sentiment', 'overall_rating', 'trip_type')
    search_fields = ('title', 'content', 'user__email', 'hotel__name')
    readonly_fields = ('sentiment', 'sentiment_score', 'helpful_count', 'report_count', 'created_at', 'updated_at')
    inlines = [ReviewPhotoInline, ReviewReplyInline]
    date_hierarchy = 'created_at'


@admin.register(ReviewPhoto)
class ReviewPhotoAdmin(admin.ModelAdmin):
    list_display = ('review', 'caption', 'uploaded_at')


@admin.register(ReviewHelpful)
class ReviewHelpfulAdmin(admin.ModelAdmin):
    list_display = ('user', 'review', 'created_at')


@admin.register(ReviewReply)
class ReviewReplyAdmin(admin.ModelAdmin):
    list_display = ('user', 'review', 'created_at')
    search_fields = ('content', 'user__email')
