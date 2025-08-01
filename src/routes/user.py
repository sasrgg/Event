from flask import Blueprint, jsonify, request, session
from src.models.user import db, User, Log, Point, Member
from src.routes.auth import login_required

user_bp = Blueprint('user_bp', __name__)

@user_bp.route('/users', methods=['GET'])
@login_required
def get_users():
    """جلب قائمة جميع المستخدمين."""
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403
    users = User.query.filter_by(is_active=True).all()
    return jsonify([user.to_dict() for user in users])

@user_bp.route('/users', methods=['POST'])
@login_required
def create_user():
    """إنشاء مستخدم جديد."""
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403

    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'visor')


    if not username or not password:
        return jsonify({'error': 'يجب إدخال اسم المستخدم وكلمة المرور'}), 400

    existing_user = User.query.filter_by(username=username).first()

    if existing_user:
        if existing_user.is_active:
            return jsonify({'error': 'اسم المستخدم موجود بالفعل'}), 409
        else:
            return jsonify({
                'error': 'USER_INACTIVE', 
                'message': 'المستخدم موجود ولكنه غير مفعل',
                'user_id': existing_user.id
            }), 409

    user = User(username=username, role=role, created_by=current_user.id)
    user.set_password(password)
    
    db.session.add(user)
    db.session.commit()

    log = Log(
        action_type='create',
        target_type='user',
        target_id=user.id,
        details=f"تم إنشاء مستخدم جديد: {user.username} بصلاحية {user.role}",
        created_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(user.to_dict()), 201

@user_bp.route('/users/<int:user_id>', methods=['PUT'])
@login_required
def update_user(user_id):
    """تحديث بيانات المستخدم."""
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403

    user = User.query.get_or_404(user_id)
    data = request.json
    
    original_username = user.username
    original_role = user.role

    new_username = data.get('username')
    if new_username and new_username != user.username:
        if User.query.filter(User.id != user_id, User.username == new_username).first():
            return jsonify({'error': 'اسم المستخدم غير متاح بالفعل'}), 409
        user.username = new_username

    user.role = data.get('role', user.role)

    password = data.get('password')
    if password:
        user.set_password(password)
        
    db.session.commit()

    details = f"تم تحديث المستخدم {original_username} (ID: {user_id}). "
    if user.username != original_username:
        details += f"اسم المستخدم تغير إلى {user.username}. "
    if user.role != original_role:
        details += f"الصلاحية تغيرت إلى {user.role}. "
    if password:
        details += "تم تحديث كلمة المرور."

    log = Log(
        action_type='update',
        target_type='user',
        target_id=user.id,
        details=details.strip(),
        created_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(user.to_dict())

@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """حذف المستخدم."""
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403
    
    if user_id == current_user.id:
        return jsonify({'error': 'لا يمكنك حذف نفسك'}), 400

    user_to_deactivate = User.query.get_or_404(user_id)
    username_for_log = user_to_deactivate.username

    user_to_deactivate.is_active = False


    log = Log(
        action_type='delete',
        target_type='user',
        target_id=user_id,
        details=f"تم إلغاء تفعيل المستخدم: {username_for_log}",
        created_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'تم إلغاء تفعيل المستخدم بنجاح'}), 200

@user_bp.route('/users/<int:user_id>/reactivate', methods=['POST'])
@login_required
def reactivate_user(user_id):
    """إعادة تفعيل مستخدم."""
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403

    user_to_reactivate = User.query.get_or_404(user_id)
    user_to_reactivate.is_active = True
    
    data = request.json
    password = data.get('password')
    if password:
       user_to_reactivate.set_password(password)

    log = Log(
        action_type='reactivate',
        target_type='user',
        target_id=user_id,
        details=f"تمت إعادة تفعيل المستخدم: {user_to_reactivate.username}",
        created_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({'message': 'تمت إعادة تفعيل المستخدم بنجاح'}), 200

@user_bp.route('/users/force-create', methods=['POST'])
@login_required
def force_create_user():
    """
    Performs a hard delete of an existing inactive user and all their
    associated data, then creates a new user with the same username.
    """
    current_user = User.query.get(session['user_id'])
    if not current_user or current_user.role != 'leader':
        return jsonify({'error': 'ليس لديك صلاحية'}), 403

    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'visor')

    if not username or not password:
        return jsonify({'error': 'بيانات غير مكتملة'}), 400

    user_to_delete = User.query.filter_by(username=username, is_active=False).first()

    if not user_to_delete:
        return jsonify({'error': 'لم يتم العثور على مستخدم غير نشط بهذا الاسم'}), 404


    
    Log.query.filter_by(created_by=user_to_delete.id).delete()
    
    Point.query.filter_by(created_by=user_to_delete.id).delete()

    Member.query.filter_by(created_by=user_to_delete.id).delete()
    
    db.session.delete(user_to_delete)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'فشل حذف المستخدم القديم: {str(e)}'}), 500

    new_user = User(username=username, role=role, created_by=current_user.id)
    new_user.set_password(password)
    
    db.session.add(new_user)
    db.session.commit()

    log = Log(
        action_type='create',
        target_type='user',
        target_id=new_user.id,
        details=f"تم حذف المستخدم القديم '{username}' وإنشاء مستخدم جديد بنفس الاسم.",
        created_by=current_user.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(new_user.to_dict()), 201