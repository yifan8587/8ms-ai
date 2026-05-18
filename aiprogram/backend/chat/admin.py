from django.contrib import admin
from .models import AIModel, Conversation, Message


@admin.register(AIModel)
class AIModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'model_id', 'is_free', 'is_active', 'context_length')
    list_filter = ('is_free', 'is_active')
    search_fields = ('name', 'model_id')


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'model', 'created_at')
    list_filter = ('model',)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'role', 'tokens_used', 'created_at')
    list_filter = ('role',)
