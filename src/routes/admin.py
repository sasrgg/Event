from flask import Blueprint, request, jsonify, session
from src.models.user import db, User, Member, Point, Log
from src.models.constants import LOG_ACTIONS, LOG_TARGETS, USER_ROLES
from src.routes.auth import login_required, role_required
from src.utils.timezone import get_saudi_now
from datetime import datetime
from sqlalchemy import and_, or_

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/users', methods=['GET'])
@role_required(['leader'])
def get_users():
    """الحصول على قائمة المستخدمين (للقائد فقط)"""
    try:
        users = User.query.filter_by(is_active=True).order_by(
            User.created_at.desc()).all()

        users_data = []
        for user in users:
            user_dict = user.to_dict()
            user_dict[
                'creator_name'] = user.creator.username if user.creator else None
            users_data.append(user_dict)

        return jsonify({'users': users_data}), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/users', methods=['POST'])
@role_required(['leader'])
def create_user():
    """إنشاء مستخدم جديد (للقائد فقط)"""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        role = data.get('role', '').strip()

        if not username or not role:
            return jsonify({'error': 'يجب إدخال اسم المستخدم والدور'}), 400

        if role not in USER_ROLES.values():
            return jsonify({'error': 'الدور غير صحيح'}), 400

        current_user = User.query.get(session['user_id'])
        if role == 'leader' and current_user.username != 'Gon':
            return jsonify(
                {'error': 'فقط Gon يمكنه إنشاء مستخدمين برتبة Leader'}), 403

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'يوجد مستخدم بهذا الاسم بالفعل'}), 400

        new_user = User(username=username,
                        role=role,
                        first_login=True,
                        created_by=session['user_id'],
                        created_at=get_saudi_now(),
                        is_active=True)
        new_user.set_password('123')

        db.session.add(new_user)
        db.session.commit()

        log_entry = Log(
            action_type=LOG_ACTIONS['CREATE'],
            target_type=LOG_TARGETS['USER'],
            target_id=new_user.id,
            details=
            f'تم إنشاء مستخدم جديد: {new_user.username} بدور {new_user.role}',
            created_by=session['user_id'])
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            'message': 'تم إنشاء المستخدم بنجاح',
            'user': new_user.to_dict()
        }), 201

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@role_required(['leader'])
def update_user(user_id):
    """تحديث بيانات المستخدم (للقائد فقط)"""
    try:
        user = User.query.filter_by(id=user_id, is_active=True).first()
        if not user:
            return jsonify({'error': 'المستخدم غير موجود'}), 404

        if user.username == 'Gon':
            return jsonify({'error':
                            'لا يمكن تعديل المستخدم الرئيسي Gon'}), 403

        current_user = User.query.get(session['user_id'])
        if user.role == 'leader' and current_user.username != 'Gon':
            return jsonify(
                {'error': 'فقط Gon يمكنه تعديل مستخدمي رتبة Leader'}), 403

        data = request.get_json()
        new_username = data.get('username', '').strip()
        new_role = data.get('role', '').strip()

        if not new_username or not new_role:
            return jsonify({'error': 'يجب إدخال اسم المستخدم والدور'}), 400

        if new_role not in USER_ROLES.values():
            return jsonify({'error': 'الدور غير صحيح'}), 400

        if new_role == 'leader' and current_user.username != 'Gon':
            return jsonify({'error': 'فقط Gon يمكنه تعيين رتبة Leader'}), 403

        existing_user = User.query.filter(
            and_(User.username == new_username, User.id != user_id)).first()

        if existing_user:
            return jsonify({'error': 'يوجد مستخدم آخر بهذا الاسم'}), 400

        old_username = user.username
        old_role = user.role

        user.username = new_username
        user.role = new_role

        log_entry = Log(
            action_type=LOG_ACTIONS['UPDATE'],
            target_type=LOG_TARGETS['USER'],
            target_id=user.id,
            details=
            f'تم تحديث المستخدم: {old_username} -> {new_username}, الدور: {old_role} -> {new_role}',
            created_by=session['user_id'])
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            'message': 'تم تحديث بيانات المستخدم بنجاح',
            'user': user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@role_required(['leader'])
def reset_user_password(user_id):
    """إعادة تعيين كلمة مرور المستخدم (للقائد فقط)"""
    try:
        user = User.query.filter_by(id=user_id, is_active=True).first()
        if not user:
            return jsonify({'error': 'المستخدم غير موجود'}), 404

        if user.username == 'Gon':
            return jsonify({
                'error':
                'لا يمكن إعادة تعيين كلمة مرور المستخدم الرئيسي Gon'
            }), 403

        current_user = User.query.get(session['user_id'])
        if user.role == 'leader' and current_user.username != 'Gon':
            return jsonify({
                'error':
                'فقط Gon يمكنه إعادة تعيين كلمة مرور مستخدمي رتبة Leader'
            }), 403

        user.set_password('123')
        user.first_login = True

        log_entry = Log(
            action_type=LOG_ACTIONS['PASSWORD_CHANGE'],
            target_type=LOG_TARGETS['USER'],
            target_id=user.id,
            details=f'تم إعادة تعيين كلمة مرور المستخدم: {user.username}',
            created_by=session['user_id'])
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({'message': 'تم إعادة تعيين كلمة المرور بنجاح'}), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@role_required(['leader'])
def delete_user(user_id):
    """حذف المستخدم (للقائد فقط)"""
    try:
        user = User.query.filter_by(id=user_id, is_active=True).first()
        if not user:
            return jsonify({'error': 'المستخدم غير موجود'}), 404

        if user.username == 'Gon':
            return jsonify({'error': 'لا يمكن حذف المستخدم الرئيسي Gon'}), 403

        if user_id == session['user_id']:
            return jsonify({'error': 'لا يمكنك حذف حسابك الخاص'}), 403

        current_user = User.query.get(session['user_id'])
        if user.role == 'leader' and current_user.username != 'Gon':
            return jsonify({'error':
                            'فقط Gon يمكنه حذف مستخدمي رتبة Leader'}), 403

        user.is_active = False

        log_entry = Log(action_type=LOG_ACTIONS['DELETE'],
                        target_type=LOG_TARGETS['USER'],
                        target_id=user.id,
                        details=f'تم حذف المستخدم: {user.username}',
                        created_by=session['user_id'])
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({'message': 'تم حذف المستخدم بنجاح'}), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/logs', methods=['GET'])
@role_required(['leader'])
def get_logs():
    """الحصول على السجلات (للقائد فقط)"""
    try:
        action_type = request.args.get('action_type')
        target_type = request.args.get('target_type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = Log.query

        if action_type and action_type in LOG_ACTIONS.values():
            query = query.filter_by(action_type=action_type)

        if target_type and target_type in LOG_TARGETS.values():
            query = query.filter_by(target_type=target_type)

        if start_date:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(Log.created_at >= start_datetime)

        if end_date:
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            query = query.filter(Log.created_at <= end_datetime)

        query = query.order_by(Log.created_at.desc())

        logs_pagination = query.paginate(page=page,
                                         per_page=per_page,
                                         error_out=False)

        logs_data = []
        for log in logs_pagination.items:
            logs_data.append(log.to_dict())

        return jsonify({
            'logs': logs_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': logs_pagination.total,
                'pages': logs_pagination.pages,
                'has_next': logs_pagination.has_next,
                'has_prev': logs_pagination.has_prev
            }
        }), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@admin_bp.route('/roles', methods=['GET'])
@login_required
def get_roles():
    """الحصول على قائمة الأدوار"""
    return jsonify({'roles': USER_ROLES}), 200
