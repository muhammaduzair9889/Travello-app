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
    list_filter = ('status', 'sentiment', 'overall_rating', 'trip_type', 'created_at')
    search_fields = ('title', 'content', 'user__email', 'hotel__name')
    readonly_fields = ('sentiment', 'sentiment_score', 'helpful_count', 'report_count', 'created_at', 'updated_at', 'id')
    inlines = [ReviewPhotoInline, ReviewReplyInline]
    date_hierarchy = 'created_at'
    actions = ['delete_selected', 'mark_as_published', 'mark_as_draft', 'mark_as_flagged', 'mark_as_removed']
    
    def delete_selected(self, request, queryset):
        """Allow bulk deletion of reviews"""
        return super().delete_selected(request, queryset)
    delete_selected.short_description = "Delete selected reviews"
    
    def mark_as_published(self, request, queryset):
        """Mark reviews as published"""
        updated = queryset.update(status='published')
        self.message_user(request, f'{updated} review(s) marked as published.')
    mark_as_published.short_description = "Mark selected as published"
    
    def mark_as_draft(self, request, queryset):
        """Mark reviews as draft"""
        updated = queryset.update(status='draft')
        self.message_user(request, f'{updated} review(s) marked as draft.')
    mark_as_draft.short_description = "Mark selected as draft"
    
    def mark_as_flagged(self, request, queryset):
        """Mark reviews as flagged"""
        updated = queryset.update(status='flagged')
        self.message_user(request, f'{updated} review(s) marked as flagged.')
    mark_as_flagged.short_description = "Mark selected as flagged"
    
    def mark_as_removed(self, request, queryset):
        """Mark reviews as removed"""
        updated = queryset.update(status='removed')
        self.message_user(request, f'{updated} review(s) marked as removed.')
    mark_as_removed.short_description = "Mark selected as removed"


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
