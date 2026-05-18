from rest_framework import serializers
from .models import AIModel, Conversation, Message, BUSINESS_TYPE_CHOICES


class AIModelSerializer(serializers.ModelSerializer):
    business_type_display = serializers.CharField(source='get_business_type_display', read_only=True)
    source_backend_name = serializers.CharField(source='source_backend.name', read_only=True, default='')
    source_group_name = serializers.CharField(source='source_group.name', read_only=True, default='')
    source_backends_info = serializers.SerializerMethodField()
    source_backends_text = serializers.SerializerMethodField()

    class Meta:
        model = AIModel
        fields = (
            'id', 'model_id', 'name', 'description', 'context_length',
            'is_free', 'is_active', 'is_visible',
            'pricing_prompt', 'pricing_completion',
            'business_type', 'business_type_display',
            'source_backend', 'source_backend_name',
            'source_backends', 'source_backends_info', 'source_backends_text',
            'source_group', 'source_group_name',
        )

    def get_source_backends_info(self, obj):
        """返回所有来源后端（含所属后端组名），用于前端展示"""
        result = []
        for backend in obj.source_backends.all():
            groups = [g.name for g in backend.groups.all()]
            result.append({
                'id': backend.id,
                'name': backend.name,
                'groups': groups,
            })
        return result

    def get_source_backends_text(self, obj):
        """拼接成 '后端A(组X), 后端B' 这样一行文本，方便在表格列里直接展示"""
        parts = []
        for backend in obj.source_backends.all():
            group_names = [g.name for g in backend.groups.all()]
            if group_names:
                parts.append(f"{backend.name}({'/'.join(group_names)})")
            else:
                parts.append(backend.name)
        return ', '.join(parts)


class PortalModelSerializer(serializers.ModelSerializer):
    """门户网站公开 API 使用的序列化器 - 不暴露后端来源信息"""
    business_type_display = serializers.CharField(source='get_business_type_display', read_only=True)

    class Meta:
        model = AIModel
        fields = (
            'id', 'model_id', 'name', 'description', 'context_length',
            'is_free', 'pricing_prompt', 'pricing_completion',
            'business_type', 'business_type_display',
        )


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ('id', 'role', 'content', 'tokens_used', 'created_at')


class ConversationSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)
    model_name = serializers.CharField(source='model.name', read_only=True)

    class Meta:
        model = Conversation
        fields = ('id', 'title', 'model', 'model_name', 'messages', 'created_at', 'updated_at')


class ConversationListSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='model.name', read_only=True)
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ('id', 'title', 'model', 'model_name', 'last_message', 'created_at', 'updated_at')

    def get_last_message(self, obj):
        msg = obj.messages.last()
        if msg:
            return {'role': msg.role, 'content': msg.content[:100]}
        return None


class ChatRequestSerializer(serializers.Serializer):
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
    model_id = serializers.CharField()
    message = serializers.CharField(allow_blank=True, default='')
    stream = serializers.BooleanField(default=False)
    images = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    system_prompt = serializers.CharField(required=False, allow_blank=True, default='')
    max_context = serializers.IntegerField(required=False, default=20, min_value=0, max_value=100)
