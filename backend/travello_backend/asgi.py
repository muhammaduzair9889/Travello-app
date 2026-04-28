"""
ASGI config for travello_backend project.
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from safety.routing import websocket_urlpatterns
from safety.ws_auth import JWTAuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'travello_backend.travello_backend.settings')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter(
	{
		'http': django_asgi_app,
		'websocket': JWTAuthMiddlewareStack(
			URLRouter(websocket_urlpatterns)
		),
	}
)




