import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.core.exceptions import ObjectDoesNotExist

from .models import SafetySession


class SafetyUserConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        self.session_key = self.scope['url_route']['kwargs']['session_key']
        self.group_name = f'safety_user_{self.session_key}'

        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        try:
            session = await SafetySession.objects.select_related('user').aget(session_key=self.session_key)
        except ObjectDoesNotExist:
            await self.close(code=4004)
            return

        if session.user_id != user.id:
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            message = json.loads(text_data)
        except json.JSONDecodeError:
            return

        message_type = message.get('type')
        if message_type == 'ping':
            await self.send(text_data=json.dumps({'event': 'pong'}))

    async def safety_event(self, event):
        await self.send(text_data=json.dumps({'event': event.get('event'), 'payload': event.get('payload', {})}))


class SafetyAdminConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated or not (user.is_staff or user.is_superuser):
            await self.close(code=4003)
            return

        self.group_name = 'safety_admin'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            message = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if message.get('type') == 'ping':
            await self.send(text_data=json.dumps({'event': 'pong'}))

    async def safety_event(self, event):
        await self.send(text_data=json.dumps({'event': event.get('event'), 'payload': event.get('payload', {})}))
