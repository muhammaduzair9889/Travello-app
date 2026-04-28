from django.urls import re_path

from .consumers import SafetyUserConsumer, SafetyAdminConsumer


websocket_urlpatterns = [
    re_path(r'^ws/safety/user/(?P<session_key>[0-9a-f-]+)/$', SafetyUserConsumer.as_asgi()),
    re_path(r'^ws/safety/admin/$', SafetyAdminConsumer.as_asgi()),
]
