from flask import Blueprint, request, jsonify, session
from src.models.user import db, User, Member, Point, Log
from src.models.constants import LOG_ACTIONS, LOG_TARGETS, POSITIVE_CATEGORIES, NEGATIVE_CATEGORIES
from src.routes.auth import login_required, role_required
from datetime import datetime
from sqlalchemy import and_, or_
from src.utils.timezone import get_saudi_now

points_bp = Blueprint('points', __name__)

@points_bp.route('/points', methods=['POST'])
@role_required(['leader', 'co_leader'])
def add_point():
    """إضافة نقطة للعضو"""
    try:
        data = request.get_json()
        member_id = data.get('member_id')
        point_type = data.get('point_type')
        category = data.get('category')
        description = data.get('description', '').strip()
        
        if not member_id or not point_type or not category:
            return jsonify({'error': 'يجب إدخال جميع البيانات المطلوبة'}), 400
        
        if point_type not in ['positive', 'negative']:
            return jsonify({'error': 'نوع النقطة غير صحيح'}), 400
        
        member = Member.query.filter_by(id=member_id, is_active=True).first()
        if not member:
            return jsonify({'error': 'العضو غير موجود'}), 404
        
        valid_categories = POSITIVE_CATEGORIES if point_type == 'positive' else NEGATIVE_CATEGORIES
        if category not in valid_categories.values():
            return jsonify({'error': 'فئة النقطة غير صحيحة'}), 400
        
        new_point = Point(
            member_id=member_id,
            point_type=point_type,
            category=category,
            description=description,
            created_by=session['user_id'],
            created_at=get_saudi_now()
        )
        
        db.session.add(new_point)
        db.session.commit()
        point_type_display = "إيجابية" if point_type == "positive" else "سلبية"

        log_entry = Log(
            action_type=LOG_ACTIONS['CREATE'],
            target_type=LOG_TARGETS['POINT'],
            target_id=new_point.id,
            details=f'تم إضافة نقطة {point_type_display} للعضو {member.name}: {category}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'تم إضافة النقطة بنجاح',
            'point': new_point.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@points_bp.route('/points', methods=['GET'])
@login_required
def get_points():
    """الحصول على قائمة النقاط"""
    try:
        member_id = request.args.get('member_id', type=int)
        point_type = request.args.get('point_type')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = Point.query.filter_by(is_active=True)
        
        if member_id:
            query = query.filter_by(member_id=member_id)
        
        if point_type and point_type in ['positive', 'negative']:
            query = query.filter_by(point_type=point_type)
        
        query = query.order_by(Point.created_at.desc())
        
        points_pagination = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        points_data = []
        for point in points_pagination.items:
            points_data.append(point.to_dict())
        
        return jsonify({
            'points': points_data,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': points_pagination.total,
                'pages': points_pagination.pages,
                'has_next': points_pagination.has_next,
                'has_prev': points_pagination.has_prev
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@points_bp.route('/points/<int:point_id>', methods=['PUT'])
@role_required(['leader', 'co_leader'])
def update_point(point_id):
    """تحديث النقطة"""
    try:
        point = Point.query.filter_by(id=point_id, is_active=True).first()
        if not point:
            return jsonify({'error': 'النقطة غير موجودة'}), 404
        
        data = request.get_json()
        category = data.get('category')
        description = data.get('description', '').strip()
        
        if not category:
            return jsonify({'error': 'يجب إدخال فئة النقطة'}), 400
        
        valid_categories = POSITIVE_CATEGORIES if point.point_type == 'positive' else NEGATIVE_CATEGORIES
        if category not in valid_categories.values():
            return jsonify({'error': 'فئة النقطة غير صحيحة'}), 400
        
        old_category = point.category
        old_description = point.description
        
        point.category = category
        point.description = description
        
        log_entry = Log(
            action_type=LOG_ACTIONS['UPDATE'],
            target_type=LOG_TARGETS['POINT'],
            target_id=point.id,
            details=f'تم تحديث نقطة للعضو {point.member.name}: من {old_category} إلى {category}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'تم تحديث النقطة بنجاح',
            'point': point.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@points_bp.route('/points/<int:point_id>', methods=['DELETE'])
@role_required(['leader', 'co_leader'])
def delete_point(point_id):
    """حذف النقطة"""
    try:
        point = Point.query.filter_by(id=point_id, is_active=True).first()
        if not point:
            return jsonify({'error': 'النقطة غير موجودة'}), 404
        
        point.is_active = False
        
        log_entry = Log(
            action_type=LOG_ACTIONS['DELETE'],
            target_type=LOG_TARGETS['POINT'],
            target_id=point.id,
            details=f'تم حذف نقطة للعضو {point.member.name}: {point.category}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({'message': 'تم حذف النقطة بنجاح'}), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@points_bp.route('/points/bulk-delete', methods=['POST'])
@role_required(['leader', 'co_leader'])
def bulk_delete_points():
    """حذف عدة نقاط"""
    try:
        data = request.get_json()
        point_ids = data.get('point_ids', [])
        
        if not point_ids or not isinstance(point_ids, list):
            return jsonify({'error': 'يجب تحديد النقاط المراد حذفها'}), 400
        
        points = Point.query.filter(
            and_(
                Point.id.in_(point_ids),
                Point.is_active == True
            )
        ).all()
        
        if not points:
            return jsonify({'error': 'لم يتم العثور على النقاط المحددة'}), 404
        
        deleted_count = 0
        for point in points:
            point.is_active = False
            
            log_entry = Log(
                action_type=LOG_ACTIONS['DELETE'],
                target_type=LOG_TARGETS['POINT'],
                target_id=point.id,
                details=f'تم حذف نقطة للعضو {point.member.name}: {point.category} (حذف جماعي)',
                created_by=session['user_id']
            )
            db.session.add(log_entry)
            deleted_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'تم حذف {deleted_count} نقطة بنجاح'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

