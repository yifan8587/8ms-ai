from django.contrib import admin
from .models import Category, Column, Article


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'sort_order', 'is_active', 'created_at')
    list_editable = ('sort_order', 'is_active')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Column)
class ColumnAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'slug', 'sort_order', 'is_active')
    list_filter = ('category', 'is_active')
    list_editable = ('sort_order', 'is_active')


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('title', 'column', 'status', 'is_top', 'view_count', 'published_at')
    list_filter = ('status', 'column__category', 'is_top')
    search_fields = ('title', 'summary', 'content')
