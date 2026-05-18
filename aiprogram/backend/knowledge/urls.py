from django.urls import path
from .views import (
    PublicCategoryListView, PublicColumnArticlesView,
    PublicCategoryArticlesView, PublicArticleDetailView,
    PublicArticleSearchView, PublicDocTreeView,
    AdminCategoryListCreateView, AdminCategoryDetailView,
    AdminColumnListCreateView, AdminColumnDetailView,
    AdminArticleListCreateView, AdminArticleDetailView,
)

urlpatterns = [
    # ── 公开 API（门户网站调用）────────────────────────────
    path('public/categories/', PublicCategoryListView.as_view(), name='kb-public-categories'),
    path('public/categories/<int:category_id>/articles/', PublicCategoryArticlesView.as_view(), name='kb-public-category-articles'),
    path('public/columns/<int:column_id>/articles/', PublicColumnArticlesView.as_view(), name='kb-public-column-articles'),
    path('public/articles/<int:pk>/', PublicArticleDetailView.as_view(), name='kb-public-article-detail'),
    path('public/search/', PublicArticleSearchView.as_view(), name='kb-public-search'),
    path('public/tree/', PublicDocTreeView.as_view(), name='kb-public-tree'),

    # ── 管理后台 API ─────────────────────────────────────
    path('admin/categories/', AdminCategoryListCreateView.as_view(), name='kb-admin-categories'),
    path('admin/categories/<int:pk>/', AdminCategoryDetailView.as_view(), name='kb-admin-category-detail'),
    path('admin/columns/', AdminColumnListCreateView.as_view(), name='kb-admin-columns'),
    path('admin/columns/<int:pk>/', AdminColumnDetailView.as_view(), name='kb-admin-column-detail'),
    path('admin/articles/', AdminArticleListCreateView.as_view(), name='kb-admin-articles'),
    path('admin/articles/<int:pk>/', AdminArticleDetailView.as_view(), name='kb-admin-article-detail'),
]
