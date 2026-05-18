from django.utils.text import slugify
from rest_framework import serializers
from html import escape
import re

from .models import Category, Column, Article


def _normalize_kb_slug(value, max_length, *, allow_empty=False):
    """将用户输入规范为 Django 可接受的 Unicode slug（去首尾空白、空格变连字符、去掉非法字符）。"""
    if value is None or (isinstance(value, str) and not value.strip()):
        if allow_empty:
            return ''
        raise serializers.ValidationError('别名不能为空')
    normalized = slugify(str(value).strip(), allow_unicode=True)
    if not normalized:
        raise serializers.ValidationError(
            '别名只能包含 Unicode 字母、数字、下划线与连字符；请去掉表情、标点或多余符号后重试'
        )
    return normalized[:max_length]


def _render_markdown_to_html(content):
    """
    将 Markdown 转成可安全展示的 HTML。
    - 优先使用 markdown + bleach（如果环境已安装）
    - 未安装依赖时，使用无依赖的简化渲染降级，避免阻塞发布
    """
    text = content or ''

    try:
        from markdown import markdown as md_render
        import bleach

        raw_html = md_render(
            text,
            extensions=['extra', 'fenced_code', 'tables', 'toc']
        )
        allowed_tags = bleach.sanitizer.ALLOWED_TAGS.union({
            'p', 'pre', 'code',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'blockquote', 'img', 'hr',
        })
        allowed_attrs = {
            **bleach.sanitizer.ALLOWED_ATTRIBUTES,
            'a': ['href', 'title', 'rel', 'target'],
            'img': ['src', 'alt', 'title'],
        }
        return bleach.clean(raw_html, tags=allowed_tags, attributes=allowed_attrs, strip=True)
    except Exception:
        # 无依赖降级：保留最核心可读性（标题、段落、代码块），避免 XSS。
        escaped = escape(text)
        blocks = escaped.split('\n')
        html_lines = []
        in_code = False

        for line in blocks:
            if line.strip().startswith('```'):
                if not in_code:
                    html_lines.append('<pre><code>')
                    in_code = True
                else:
                    html_lines.append('</code></pre>')
                    in_code = False
                continue

            if in_code:
                html_lines.append(line)
                continue

            if line.startswith('### '):
                html_lines.append(f"<h3>{line[4:].strip()}</h3>")
                continue
            if line.startswith('## '):
                html_lines.append(f"<h2>{line[3:].strip()}</h2>")
                continue
            if line.startswith('# '):
                html_lines.append(f"<h1>{line[2:].strip()}</h1>")
                continue

            # 简单链接渲染 [text](url)
            line = re.sub(
                r'\[([^\]]+)\]\((https?://[^\s)]+)\)',
                r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>',
                line
            )
            # 简单加粗/斜体渲染
            line = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', line)
            line = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', line)

            if line.strip():
                html_lines.append(f"<p>{line}</p>")
            else:
                html_lines.append('<p></p>')

        if in_code:
            html_lines.append('</code></pre>')
        return ''.join(html_lines)


# ─── 公开 API（门户网站用）─────────────────────────────────────────

class PublicArticleListSerializer(serializers.ModelSerializer):
    column_name = serializers.CharField(source='column.name', read_only=True)
    category_name = serializers.CharField(source='column.category.name', read_only=True)
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ('id', 'title', 'slug', 'summary', 'cover_image',
                  'column', 'column_name', 'category_name',
                  'author_name', 'tags', 'view_count',
                  'is_top', 'published_at', 'created_at')

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.nickname or obj.author.username
        return ''


class PublicArticleDetailSerializer(serializers.ModelSerializer):
    column_name = serializers.CharField(source='column.name', read_only=True)
    category_name = serializers.CharField(source='column.category.name', read_only=True)
    category_id = serializers.IntegerField(source='column.category.id', read_only=True)
    author_name = serializers.SerializerMethodField()
    content_html = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = ('id', 'title', 'slug', 'summary', 'cover_image', 'content', 'content_html',
                  'column', 'column_name', 'category_id', 'category_name',
                  'author_name', 'tags', 'view_count',
                  'is_top', 'published_at', 'created_at', 'updated_at')

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.nickname or obj.author.username
        return ''

    def get_content_html(self, obj):
        return _render_markdown_to_html(obj.content)


class PublicColumnSerializer(serializers.ModelSerializer):
    article_count = serializers.SerializerMethodField()

    class Meta:
        model = Column
        fields = ('id', 'name', 'slug', 'description', 'article_count')

    def get_article_count(self, obj):
        return obj.articles.filter(status='published').count()


class PublicCategorySerializer(serializers.ModelSerializer):
    columns = PublicColumnSerializer(many=True, read_only=True)

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'icon', 'columns')

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['columns'] = [c for c in ret['columns']
                          if Column.objects.filter(pk=c['id'], is_active=True).exists()]
        return ret


# ─── 管理后台 ──────────────────────────────────────────────────────

class AdminCategorySerializer(serializers.ModelSerializer):
    column_count = serializers.SerializerMethodField()
    slug = serializers.CharField(max_length=100)

    class Meta:
        model = Category
        fields = ('id', 'name', 'slug', 'description', 'icon',
                  'sort_order', 'is_active', 'column_count',
                  'created_at', 'updated_at')

    def validate_slug(self, value):
        return _normalize_kb_slug(value, 100, allow_empty=False)

    def get_column_count(self, obj):
        return obj.columns.count()


class AdminColumnSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    article_count = serializers.SerializerMethodField()
    slug = serializers.CharField(max_length=100)

    class Meta:
        model = Column
        fields = ('id', 'category', 'category_name', 'name', 'slug',
                  'description', 'sort_order', 'is_active', 'article_count',
                  'created_at', 'updated_at')

    def validate_slug(self, value):
        return _normalize_kb_slug(value, 100, allow_empty=False)

    def get_article_count(self, obj):
        return obj.articles.count()


class AdminArticleListSerializer(serializers.ModelSerializer):
    column_name = serializers.CharField(source='column.name', read_only=True)
    category_name = serializers.CharField(source='column.category.name', read_only=True)
    author_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Article
        fields = ('id', 'title', 'slug', 'summary', 'cover_image', 'status', 'status_display',
                  'column', 'column_name', 'category_name',
                  'author_name', 'tags', 'view_count', 'sort_order', 'is_top',
                  'published_at', 'created_at', 'updated_at')

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.nickname or obj.author.username
        return ''


class AdminArticleDetailSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(max_length=200, allow_blank=True, required=False, default='')

    class Meta:
        model = Article
        fields = ('id', 'column', 'title', 'slug', 'summary', 'cover_image',
                  'content', 'status', 'tags', 'sort_order', 'is_top', 'published_at')

    def validate_slug(self, value):
        return _normalize_kb_slug(value, 200, allow_empty=True)
