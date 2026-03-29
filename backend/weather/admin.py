from django.contrib import admin
from .models import WeatherCache


@admin.register(WeatherCache)
class WeatherCacheAdmin(admin.ModelAdmin):
    list_display = ['city', 'temperature', 'condition', 'humidity', 'wind_speed', 'updated_at']
    search_fields = ['city']
    readonly_fields = ['last_updated', 'updated_at']
    list_filter = ['updated_at', 'condition']
    ordering = ['-updated_at']

    fieldsets = (
        ('City', {
            'fields': ('city',)
        }),
        ('Weather Data', {
            'fields': ('temperature', 'condition', 'humidity', 'wind_speed', 'icon_code')
        }),
        ('Timestamps', {
            'fields': ('last_updated', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
