from django.db import models
from django.conf import settings


class Category(models.Model):
    """知识库分类（一级）"""
    name = models.CharField(max_length=100, unique=True, verbose_name='分类名称')
    slug = models.SlugField(max_length=100, unique=True, allow_unicode=True, verbose_name='URL别名',
                            help_text='用于 URL，字母/数字/连字符；也可使用中文等 Unicode（将编码进路径）')
    description = models.CharField(max_length=300, blank=True, verbose_name='分类描述')
    icon = models.CharField(max_length=50, blank=True, verbose_name='图标',
                            help_text='Element Plus 图标名或 emoji')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    is_active = models.BooleanField(default=True, verbose_name='是否显示')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '知识库分类'
        verbose_name_plural = '知识库分类'
        ordering = ['sort_order', 'name']

    def __str__(self):
        return self.name


class Column(models.Model):
    """知识库栏目（二级，属于某个分类下）"""
    category = models.ForeignKey(Category, on_delete=models.CASCADE,
                                 related_name='columns', verbose_name='所属分类')
    name = models.CharField(max_length=100, verbose_name='栏目名称')
    slug = models.SlugField(max_length=100, allow_unicode=True, verbose_name='URL别名')
    description = models.CharField(max_length=300, blank=True, verbose_name='栏目描述')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    is_active = models.BooleanField(default=True, verbose_name='是否显示')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '知识库栏目'
        verbose_name_plural = '知识库栏目'
        ordering = ['sort_order', 'name']
        unique_together = ('category', 'slug')

    def __str__(self):
        return f"{self.category.name} / {self.name}"


class Article(models.Model):
    """知识库文章（富文本）"""
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('published', '已发布'),
        ('archived', '已归档'),
    ]

    column = models.ForeignKey(Column, on_delete=models.CASCADE,
                               related_name='articles', verbose_name='所属栏目')
    title = models.CharField(max_length=200, verbose_name='文章标题')
    slug = models.SlugField(max_length=200, blank=True, allow_unicode=True, verbose_name='URL别名')
    summary = models.CharField(max_length=500, blank=True, verbose_name='摘要')
    cover_image = models.URLField(blank=True, verbose_name='封面图片URL')
    content = models.TextField(verbose_name='正文内容(HTML富文本)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES,
                              default='draft', verbose_name='状态')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                               null=True, blank=True, verbose_name='作者')
    view_count = models.PositiveIntegerField(default=0, verbose_name='浏览次数')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    is_top = models.BooleanField(default=False, verbose_name='是否置顶')
    tags = models.CharField(max_length=500, blank=True, verbose_name='标签',
                            help_text='逗号分隔')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')

    class Meta:
        verbose_name = '知识库文章'
        verbose_name_plural = '知识库文章'
        ordering = ['-is_top', '-sort_order', '-published_at', '-created_at']
        indexes = [
            models.Index(fields=['status', '-published_at']),
            models.Index(fields=['column', 'status']),
        ]

    def __str__(self):
        return self.title
