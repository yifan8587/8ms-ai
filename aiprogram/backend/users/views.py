from decimal import Decimal
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q, Sum
from django.utils import timezone

from .models import APIToken
from .serializers import (
    RegisterSerializer, UserProfileSerializer,
    APITokenSerializer, APITokenCreateSerializer,
    AdminUserSerializer, AdminUserUpdateSerializer,
    SubAccountCreateSerializer,
)

User = get_user_model()


class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'code': 200,
            'msg': '注册成功',
            'data': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data,
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'code': 401, 'msg': '用户名或密码错误'}, status=status.HTTP_401_UNAUTHORIZED)
        if user.customer_status == 'banned':
            return Response({'code': 403, 'msg': '账号已被封禁，请联系客服'}, status=status.HTTP_403_FORBIDDEN)
        if user.customer_status == 'suspended':
            return Response({'code': 403, 'msg': '账号已暂停使用，请联系客服'}, status=status.HTTP_403_FORBIDDEN)
        refresh = RefreshToken.for_user(user)
        return Response({
            'code': 200,
            'msg': '登录成功',
            'data': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data,
            }
        })


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not old_password or not new_password:
            return Response({'code': 400, 'msg': '旧密码和新密码均不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({'code': 400, 'msg': '新密码至少6位'}, status=status.HTTP_400_BAD_REQUEST)
        if not request.user.check_password(old_password):
            return Response({'code': 400, 'msg': '旧密码错误'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])
        return Response({'code': 200, 'msg': '密码修改成功'})


# ─── API Token 管理 ──────────────────────────────────────────────

class APITokenListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        tokens = APIToken.objects.filter(user=request.user)
        return Response(APITokenSerializer(tokens, many=True).data)

    def post(self, request):
        name = request.data.get('name', '').strip()
        permissions_val = request.data.get('permissions', 'chat')
        expires_at = request.data.get('expires_at', None)
        if not name:
            return Response({'code': 400, 'msg': '请输入Token名称'}, status=status.HTTP_400_BAD_REQUEST)
        token = APIToken.objects.create(
            user=request.user,
            name=name,
            token_key=APIToken.generate_key(),
            permissions=permissions_val,
            expires_at=expires_at,
        )
        return Response({
            'code': 200,
            'msg': '创建成功，请保存Token值，关闭后将不再显示完整值',
            'data': APITokenCreateSerializer(token).data,
        }, status=status.HTTP_201_CREATED)


class APITokenDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return APIToken.objects.get(pk=pk, user=user)
        except APIToken.DoesNotExist:
            return None

    def patch(self, request, pk):
        token = self.get_object(pk, request.user)
        if not token:
            return Response({'code': 404, 'msg': 'Token不存在'}, status=status.HTTP_404_NOT_FOUND)
        token.name = request.data.get('name', token.name)
        token.is_active = request.data.get('is_active', token.is_active)
        token.save()
        return Response({'code': 200, 'msg': '更新成功', 'data': APITokenSerializer(token).data})

    def delete(self, request, pk):
        token = self.get_object(pk, request.user)
        if not token:
            return Response({'code': 404, 'msg': 'Token不存在'}, status=status.HTTP_404_NOT_FOUND)
        token.delete()
        return Response({'code': 200, 'msg': '已删除'})


# ─── 管理员 - 客户管理 ─────────────────────────────────────────────

class AdminCustomerListView(generics.ListAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = User.objects.all().order_by('-date_joined')
        q = self.request.query_params.get('q')
        tier = self.request.query_params.get('tier')
        cstatus = self.request.query_params.get('status')
        account_type = self.request.query_params.get('account_type')
        parent_id = self.request.query_params.get('parent_id')
        if q:
            qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) |
                           Q(nickname__icontains=q) | Q(phone__icontains=q) | Q(company__icontains=q))
        if tier:
            qs = qs.filter(tier=tier)
        if cstatus:
            qs = qs.filter(customer_status=cstatus)
        if account_type == 'main':
            qs = qs.filter(is_sub_account=False)
        elif account_type == 'sub':
            qs = qs.filter(is_sub_account=True)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(AdminUserSerializer(page, many=True).data)
        return Response(AdminUserSerializer(qs, many=True).data)


class AdminCustomerDetailView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserSerializer(user).data)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        old_tier = user.tier
        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if 'tier' in request.data and user.tier != old_tier:
            user.subscription_billing_anchor = timezone.now()
            user.save(update_fields=['subscription_billing_anchor'])
        if 'allowed_model_ids' in request.data:
            user.allowed_models.set(request.data['allowed_model_ids'])
        if 'allowed_backend_group_ids' in request.data:
            user.allowed_backend_groups.set(request.data['allowed_backend_group_ids'])
        return Response({'code': 200, 'msg': '更新成功', 'data': AdminUserSerializer(user).data})

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)
        if user.is_superuser:
            return Response({'code': 403, 'msg': '不能删除超级管理员'}, status=status.HTTP_403_FORBIDDEN)
        if user == request.user:
            return Response({'code': 403, 'msg': '不能删除自己'}, status=status.HTTP_403_FORBIDDEN)
        username = user.username
        user.delete()
        return Response({'code': 200, 'msg': f'用户 {username} 已删除'})


class AdminCreateMainAccountView(APIView):
    """管理员创建主账号"""
    permission_classes = [IsAdminUser]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        nickname = request.data.get('nickname', '')
        email = request.data.get('email', '')
        phone = request.data.get('phone', '')
        company = request.data.get('company', '')
        tier = request.data.get('tier', 'free')

        if not username or not password:
            return Response({'code': 400, 'msg': '用户名和密码必填'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'code': 400, 'msg': '密码至少6位'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'code': 400, 'msg': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)

        user = User(
            username=username,
            nickname=nickname,
            email=email,
            phone=phone,
            company=company,
            tier=tier,
            is_sub_account=False,
        )
        user.set_password(password)
        user.save()
        return Response({
            'code': 200,
            'msg': f'主账号 {username} 创建成功',
            'data': AdminUserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class AdminCreateSubAccountView(APIView):
    """管理员为主账号创建子账号"""
    permission_classes = [IsAdminUser]

    def post(self, request, parent_id):
        try:
            parent = User.objects.get(pk=parent_id)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '主账号不存在'}, status=status.HTTP_404_NOT_FOUND)
        if parent.is_sub_account:
            return Response({'code': 400, 'msg': '子账号不能再创建子账号'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubAccountCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        if User.objects.filter(username=d['username']).exists():
            return Response({'code': 400, 'msg': '用户名已存在'}, status=status.HTTP_400_BAD_REQUEST)

        sub = User(
            username=d['username'],
            nickname=d.get('nickname', ''),
            email=d.get('email', ''),
            parent=parent,
            is_sub_account=True,
            tier=parent.tier,
            monthly_token_limit=d.get('monthly_token_limit', 0),
        )
        sub.set_password(d['password'])
        sub.save()

        model_ids = d.get('allowed_model_ids', [])
        if model_ids:
            sub.allowed_models.set(model_ids)

        return Response({
            'code': 200,
            'msg': f'子账号 {sub.username} 创建成功',
            'data': AdminUserSerializer(sub).data,
        }, status=status.HTTP_201_CREATED)


class AdminSubAccountUsageView(APIView):
    """查看主账号下所有子账号的汇总用量"""
    permission_classes = [IsAdminUser]

    def get(self, request, parent_id):
        try:
            parent = User.objects.get(pk=parent_id)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        sub_ids = list(parent.sub_accounts.values_list('id', flat=True))
        all_ids = [parent.id] + sub_ids

        from chat.models import Message
        from billing.models import DailyUsage
        from datetime import date, timedelta

        days = int(request.query_params.get('days', 30))
        start = date.today() - timedelta(days=days - 1)

        usage = DailyUsage.objects.filter(user_id__in=all_ids, date__gte=start)
        by_user = list(
            usage.values('user__username', 'user_id', 'user__is_sub_account').annotate(
                messages=Sum('message_count'),
                tokens=Sum('token_count'),
                cost=Sum('cost'),
            ).order_by('-tokens')
        )
        totals = usage.aggregate(
            total_messages=Sum('message_count'),
            total_tokens=Sum('token_count'),
            total_cost=Sum('cost'),
        )

        return Response({
            'parent': {'id': parent.id, 'username': parent.username},
            'sub_account_count': len(sub_ids),
            'totals': totals,
            'by_user': by_user,
        })


class AdminCustomerPasswordResetView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'code': 404, 'msg': '用户不存在'}, status=status.HTTP_404_NOT_FOUND)

        new_password = request.data.get('new_password', '')
        if not new_password:
            return Response({'code': 400, 'msg': '新密码不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({'code': 400, 'msg': '新密码至少6位'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'code': 200, 'msg': f'用户 {user.username} 密码已重置'})


# ─── 管理员 - API Token ────────────────────────────────────────────

class AdminAPITokenListView(generics.ListAPIView):
    serializer_class = APITokenSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = APIToken.objects.select_related('user').all()
        uid = self.request.query_params.get('user_id')
        if uid:
            qs = qs.filter(user_id=uid)
        return qs


class AdminAPITokenDetailView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            token = APIToken.objects.get(pk=pk)
        except APIToken.DoesNotExist:
            return Response({'code': 404, 'msg': 'Token不存在'}, status=status.HTTP_404_NOT_FOUND)
        token.is_active = request.data.get('is_active', token.is_active)
        token.save()
        return Response({'code': 200, 'msg': '更新成功'})

    def delete(self, request, pk):
        try:
            token = APIToken.objects.get(pk=pk)
        except APIToken.DoesNotExist:
            return Response({'code': 404, 'msg': 'Token不存在'}, status=status.HTTP_404_NOT_FOUND)
        token.delete()
        return Response({'code': 200, 'msg': '已删除'})
