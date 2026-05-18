from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.views import IsAdminUser
from .models import Category, Column, Article
from .serializers import (
    PublicCategorySerializer, PublicColumnSerializer,
    PublicArticleListSerializer, PublicArticleDetailSerializer,
    AdminCategorySerializer, AdminColumnSerializer,
    AdminArticleListSerializer, AdminArticleDetailSerializer,
)


# ═══════════════════════════════════════════════════════════════════
#  公开 API（供前端门户网站调用，无需登录）
# ═══════════════════════════════════════════════════════════════════

class PublicCategoryListView(generics.ListAPIView):
    """公开 - 获取所有分类及其栏目"""
    serializer_class = PublicCategorySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Category.objects.filter(is_active=True).prefetch_related('columns')


class PublicColumnArticlesView(generics.ListAPIView):
    """公开 - 按栏目获取文章列表"""
    serializer_class = PublicArticleListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        column_id = self.kwargs['column_id']
        return (Article.objects
                .filter(column_id=column_id, status='published',
                        column__is_active=True, column__category__is_active=True)
                .select_related('column__category', 'author'))


class PublicCategoryArticlesView(generics.ListAPIView):
    """公开 - 按分类获取文章列表"""
    serializer_class = PublicArticleListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        category_id = self.kwargs['category_id']
        return (Article.objects
                .filter(column__category_id=category_id, status='published',
                        column__is_active=True, column__category__is_active=True)
                .select_related('column__category', 'author'))


class PublicArticleDetailView(generics.RetrieveAPIView):
    """公开 - 文章详情（自动 +1 浏览量）"""
    serializer_class = PublicArticleDetailSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return (Article.objects
                .filter(status='published',
                        column__is_active=True, column__category__is_active=True)
                .select_related('column__category', 'author'))

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        Article.objects.filter(pk=instance.pk).update(view_count=instance.view_count + 1)
        instance.view_count += 1
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class PublicDocTreeView(APIView):
    """
    公开 - 一次性返回完整文档树（分类 → 栏目 → 文章简要信息）。
    设计上贴近 apifox 左侧导航体验：前端只需一次请求就能绘制整棵目录。
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        categories = (Category.objects
                      .filter(is_active=True)
                      .prefetch_related('columns__articles')
                      .order_by('sort_order', 'id'))

        data = []
        for cat in categories:
            cat_item = {
                'id': cat.id,
                'name': cat.name,
                'slug': cat.slug,
                'icon': cat.icon,
                'description': cat.description,
                'columns': [],
            }
            for col in cat.columns.filter(is_active=True).order_by('sort_order', 'id'):
                articles = (col.articles
                            .filter(status='published')
                            .order_by('-is_top', 'sort_order', '-published_at', '-created_at')
                            .values('id', 'title', 'slug', 'is_top', 'view_count'))
                cat_item['columns'].append({
                    'id': col.id,
                    'name': col.name,
                    'slug': col.slug,
                    'description': col.description,
                    'articles': list(articles),
                })
            data.append(cat_item)

        return Response({'results': data})


class PublicArticleSearchView(generics.ListAPIView):
    """公开 - 搜索文章"""
    serializer_class = PublicArticleListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        from django.db.models import Q
        q = self.request.query_params.get('q', '').strip()
        qs = (Article.objects
              .filter(status='published',
                      column__is_active=True, column__category__is_active=True)
              .select_related('column__category', 'author'))
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q) |
                           Q(content__icontains=q) | Q(tags__icontains=q))
        return qs


# ═══════════════════════════════════════════════════════════════════
#  管理后台 API（需管理员权限）
# ═══════════════════════════════════════════════════════════════════

class AdminCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminCategorySerializer
    permission_classes = [IsAdminUser]
    queryset = Category.objects.all()


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminCategorySerializer
    permission_classes = [IsAdminUser]
    queryset = Category.objects.all()


class AdminColumnListCreateView(generics.ListCreateAPIView):
    serializer_class = AdminColumnSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = Column.objects.select_related('category').all()
        cat_id = self.request.query_params.get('category')
        if cat_id:
            qs = qs.filter(category_id=cat_id)
        return qs


class AdminColumnDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminColumnSerializer
    permission_classes = [IsAdminUser]
    queryset = Column.objects.select_related('category').all()


class AdminArticleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AdminArticleDetailSerializer
        return AdminArticleListSerializer

    def get_queryset(self):
        qs = (Article.objects
              .select_related('column__category', 'author')
              .all())
        q = self.request.query_params.get('q')
        col_id = self.request.query_params.get('column')
        cat_id = self.request.query_params.get('category')
        st = self.request.query_params.get('status')
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=q) | Q(summary__icontains=q))
        if col_id:
            qs = qs.filter(column_id=col_id)
        if cat_id:
            qs = qs.filter(column__category_id=cat_id)
        if st:
            qs = qs.filter(status=st)
        return qs

    def perform_create(self, serializer):
        article = serializer.save(author=self.request.user)
        if article.status == 'published' and not article.published_at:
            article.published_at = timezone.now()
            article.save(update_fields=['published_at'])


class AdminArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AdminArticleDetailSerializer
    permission_classes = [IsAdminUser]
    queryset = Article.objects.all()

    def perform_update(self, serializer):
        article = serializer.save()
        if article.status == 'published' and not article.published_at:
            article.published_at = timezone.now()
            article.save(update_fields=['published_at'])
