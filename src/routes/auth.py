from flask import Blueprint, request, jsonify, session
from src.models.user import db, User, Log
from src.models.constants import LOG_ACTIONS, LOG_TARGETS
from datetime import datetime
import functools

auth_bp = Blueprint('auth', __name__)


def login_required(f):
    """ديكوريتر للتحقق من تسجيل الدخول"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'يجب تسجيل الدخول أولاً'}), 401

        try:
            user = User.query.get(session['user_id'])
            if not user or not user.is_active:
                session.clear()
                return jsonify({
                    'error':
                    'الجلسة منتهية الصلاحية، يرجى تسجيل الدخول مرة أخرى'
                }), 401
        except Exception:
            session.clear()
            return jsonify({'error': 'خطأ في التحقق من الجلسة'}), 401

        return f(*args, **kwargs)

    return decorated_function


def role_required(roles):
    """ديكوريتر للتحقق من الصلاحيات"""

    def decorator(f):

        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'يجب تسجيل الدخول أولاً'}), 401

            user = User.query.get(session['user_id'])
            if not user or user.role not in roles:
                return jsonify({'error':
                                'ليس لديك صلاحية للوصول لهذه الصفحة'}), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator


@auth_bp.route('/login', methods=['POST'])
def login():
    """تسجيل الدخول"""
    try:
        session.clear()

        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '')

        if not username or not password:
            return jsonify({'error':
                            'يجب إدخال اسم المستخدم وكلمة المرور'}), 400

        user = User.query.filter_by(username=username, is_active=True).first()

        if not user or not user.check_password(password):
            return jsonify({'error':
                            'اسم المستخدم أو كلمة المرور غير صحيحة'}), 401

        session['user_id'] = user.id
        session['username'] = user.username
        session['role'] = user.role
        session.permanent = True

        log_entry = Log(action_type=LOG_ACTIONS['LOGIN'],
                        target_type=LOG_TARGETS['USER'],
                        target_id=user.id,
                        details=f'تسجيل دخول المستخدم: {user.username}',
                        created_by=user.id)
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            'message': 'تم تسجيل الدخول بنجاح',
            'user': user.to_dict(),
            'first_login': user.first_login
        }), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """تسجيل الخروج"""
    try:
        user_id = session.get('user_id')
        username = session.get('username')

        if user_id:
            log_entry = Log(action_type=LOG_ACTIONS['LOGOUT'],
                            target_type=LOG_TARGETS['USER'],
                            target_id=user_id,
                            details=f'تسجيل خروج المستخدم: {username}',
                            created_by=user_id)
            db.session.add(log_entry)
            db.session.commit()

        session.clear()
        session.permanent = False

        response = jsonify({'message': 'تم تسجيل الخروج بنجاح'})
        response.set_cookie('session', '', expires=0, path='/')

        return response, 200
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """تغيير كلمة المرور"""
    try:
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')

        if not current_password or not new_password or not confirm_password:
            return jsonify({'error': 'يجب إدخال جميع الحقول'}), 400

        if new_password != confirm_password:
            return jsonify({'error': 'كلمة المرور الجديدة غير متطابقة'}), 400

        if len(new_password) < 3:
            return jsonify(
                {'error': 'كلمة المرور يجب أن تكون 3 أحرف على الأقل'}), 400

        user = User.query.get(session['user_id'])
        if not user.check_password(current_password):
            return jsonify({'error': 'كلمة المرور الحالية غير صحيحة'}), 401

        if new_password == '123':
            return jsonify(
                {'error':
                 'لا يمكن استخدام كلمة المرور المبدئية مرة أخرى'}), 400

        user.set_password(new_password)
        user.first_login = False

        log_entry = Log(
            action_type=LOG_ACTIONS['PASSWORD_CHANGE'],
            target_type=LOG_TARGETS['USER'],
            target_id=user.id,
            details=f'تم تغيير كلمة مرور المستخدم: {user.username}',
            created_by=user.id)
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({'message': 'تم تغيير كلمة المرور بنجاح'}), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500


@auth_bp.route('/current-user', methods=['GET'])
@login_required
def get_current_user():
    """الحصول على معلومات المستخدم الحالي"""
    try:
        user = User.query.get(session['user_id'])
        if not user:
            return jsonify({'error': 'المستخدم غير موجود'}), 404

        return jsonify({'user': user.to_dict()}), 200

    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500
