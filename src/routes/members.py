from flask import Blueprint, request, jsonify, session
from src.models.user import db, User, Member, Point, Log
from src.models.constants import LOG_ACTIONS, LOG_TARGETS, POSITIVE_CATEGORIES, NEGATIVE_CATEGORIES
from src.routes.auth import login_required, role_required
from datetime import datetime, timedelta
from sqlalchemy import and_, or_

members_bp = Blueprint('members', __name__)

@members_bp.route('/members', methods=['GET'])
@login_required
def get_members():
    """الحصول على قائمة الأعضاء مع النقاط"""
    try:
        period = request.args.get('period', 'all')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        date_filter = None
        if period == 'today':
            date_filter = datetime.now().date()
        elif period == 'week':
            date_filter = datetime.now() - timedelta(days=7)
        elif period == 'month':
            date_filter = datetime.now() - timedelta(days=30)
        elif period == 'custom' and start_date and end_date:
            date_filter = {
                'start': datetime.strptime(start_date, '%Y-%m-%d'),
                'end': datetime.strptime(end_date, '%Y-%m-%d')
            }
        
        members = Member.query.filter_by(is_active=True).all()
        
        members_data = []
        for member in members:
            points_query = Point.query.filter_by(member_id=member.id, is_active=True)
            
            if period == 'today' and date_filter:
                points_query = points_query.filter(
                    db.func.date(Point.created_at) == date_filter
                )
            elif period in ['week', 'month'] and date_filter:
                points_query = points_query.filter(Point.created_at >= date_filter)
            elif period == 'custom' and isinstance(date_filter, dict):
                points_query = points_query.filter(
                    and_(
                        Point.created_at >= date_filter['start'],
                        Point.created_at <= date_filter['end']
                    )
                )
            
            points = points_query.all()
            positive_count = len([p for p in points if p.point_type == 'positive'])
            negative_count = len([p for p in points if p.point_type == 'negative'])
            
            members_data.append({
                'id': member.id,
                'name': member.name,
                'positive_count': positive_count,
                'negative_count': negative_count,
                'total_points': positive_count - negative_count,
                'created_at': member.created_at.isoformat() if member.created_at else None
            })
        
        members_data.sort(key=lambda x: x['total_points'], reverse=True)
        
        return jsonify({
            'members': members_data,
            'period': period
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@members_bp.route('/members', methods=['POST'])
@role_required(['leader', 'co_leader'])
def add_member():
    """إضافة عضو جديد"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'error': 'يجب إدخال اسم العضو'}), 400
        
        existing_member = Member.query.filter_by(name=name, is_active=True).first()
        if existing_member:
            return jsonify({'error': 'يوجد عضو بهذا الاسم بالفعل'}), 400
        
        new_member = Member(
            name=name,
            created_by=session['user_id'],
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_member)
        db.session.commit()
        
        log_entry = Log(
            action_type=LOG_ACTIONS['CREATE'],
            target_type=LOG_TARGETS['MEMBER'],
            target_id=new_member.id,
            details=f'تم إضافة عضو جديد: {new_member.name}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'تم إضافة العضو بنجاح',
            'member': new_member.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@members_bp.route('/members/<int:member_id>', methods=['GET'])
@login_required
def get_member_details(member_id):
    """الحصول على تفاصيل العضو"""
    try:
        member = Member.query.filter_by(id=member_id, is_active=True).first()
        if not member:
            return jsonify({'error': 'العضو غير موجود'}), 404


                period = request.args.get('period', 'week')  # الافتراضي هو 'week'
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        note_type = request.args.get('note_type', 'negative')  # الافتراضي هو 'negative'

        # تحديد نطاق التاريخ بناءً على 'period'
        if period == 'today':
            start_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            end_date = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        elif period == 'week':
            start_date = datetime.utcnow() - timedelta(days=7)
            end_date = datetime.utcnow()
        elif period == 'month':
            start_date = datetime.utcnow() - timedelta(days=30)
            end_date = datetime.utcnow()
        elif period == 'custom' and start_date_str and end_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
        else:
            # الافتراضي إذا لم يتم تحديد فترة صالحة
            start_date = datetime.utcnow() - timedelta(days=7)
            end_date = datetime.utcnow()

        # جلب الملاحظات بناءً على نوع الملاحظة والفترة الزمنية
        filtered_points_query = Point.query.filter(
            and_(
                Point.member_id == member.id,
                Point.point_type == note_type,
                Point.created_at >= start_date,
                Point.created_at <= end_date,
                Point.is_active == True
            )
        ).order_by(Point.created_at.desc())

        filtered_notes = []
        for point in filtered_points_query.all():
            filtered_notes.append({
                'id': point.id,
                'category': point.category,
                'description': point.description,
                'created_at': point.created_at.isoformat(),
                'created_by': point.creator.username if point.creator else None
            })

        
        all_points = Point.query.filter_by(member_id=member.id, is_active=True).all()
        total_positive = len([p for p in all_points if p.point_type == 'positive'])
        total_negative = len([p for p in all_points if p.point_type == 'negative'])
        
        current_week_start = datetime.now() - timedelta(days=7)
        current_week_points = Point.query.filter(
            and_(
                Point.member_id == member.id,
                Point.created_at >= current_week_start,
                Point.is_active == True
            )
        ).all()
        current_week_positive = len([p for p in current_week_points if p.point_type == 'positive'])
        current_week_negative = len([p for p in current_week_points if p.point_type == 'negative'])
        
        previous_week_start = datetime.now() - timedelta(days=14)
        previous_week_end = datetime.now() - timedelta(days=7)
        previous_week_points = Point.query.filter(
            and_(
                Point.member_id == member.id,
                Point.created_at >= previous_week_start,
                Point.created_at < previous_week_end,
                Point.is_active == True
            )
        ).all()
        previous_week_positive = len([p for p in previous_week_points if p.point_type == 'positive'])
        previous_week_negative = len([p for p in previous_week_points if p.point_type == 'negative'])
        
        current_total = current_week_positive - current_week_negative
        previous_total = previous_week_positive - previous_week_negative
        
        if current_total > previous_total:
            performance = 'متحسن'
        elif current_total < previous_total:
            performance = 'متراجع'
        else:
            performance = 'ثابت'
        
       # recent_negative_points = Point.query.filter(
        #     and_(
        #         Point.member_id == member.id,
        #         Point.point_type == 'negative',
        #         Point.created_at >= current_week_start,
        #         Point.is_active == True
        #     )
        # ).order_by(Point.created_at.desc()).all()

        # negative_notes = []
        # for point in recent_negative_points:
        #     negative_notes.append({
        #         'id': point.id,
        #         'category': point.category,
        #         'description': point.description,
        #         'created_at': point.created_at.isoformat(),
        #         'created_by': point.creator.username if point.creator else None
        #     })


        
        filtered_chat_activities = Point.query.filter(
            and_(
                Point.member_id == member.id,
                Point.point_type == 'positive',
                Point.category == 'فعالية في الشات العام',
                Point.created_at >= start_date,
                Point.created_at <= end_date,
                Point.is_active == True
            )
        ).count()
        
        return jsonify({
            'member': member.to_dict(),
            'statistics': {
                'total_positive': total_positive,
                'total_negative': total_negative,
                'filtered_chat_activities': filtered_chat_activities,
                'current_week_positive': current_week_positive,
                'current_week_negative': current_week_negative,
                'previous_week_positive': previous_week_positive,
                'previous_week_negative': previous_week_negative,
                'performance': performance
            },
            'filtered_notes': filtered_notes,  # تم تغيير الاسم إلى filtered_notes
            'note_type': note_type,
            'period': period 
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@members_bp.route('/members/<int:member_id>', methods=['PUT'])
@role_required(['leader', 'co_leader'])
def update_member(member_id):
    """تحديث بيانات العضو"""
    try:
        member = Member.query.filter_by(id=member_id, is_active=True).first()
        if not member:
            return jsonify({'error': 'العضو غير موجود'}), 404
        
        data = request.get_json()
        new_name = data.get('name', '').strip()
        
        if not new_name:
            return jsonify({'error': 'يجب إدخال اسم العضو'}), 400
        
        existing_member = Member.query.filter(
            and_(
                Member.name == new_name,
                Member.id != member_id,
                Member.is_active == True
            )
        ).first()
        
        if existing_member:
            return jsonify({'error': 'يوجد عضو آخر بهذا الاسم'}), 400
        
        old_name = member.name
        member.name = new_name
        
        log_entry = Log(
            action_type=LOG_ACTIONS['UPDATE'],
            target_type=LOG_TARGETS['MEMBER'],
            target_id=member.id,
            details=f'تم تحديث اسم العضو من {old_name} إلى {new_name}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({
            'message': 'تم تحديث بيانات العضو بنجاح',
            'member': member.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@members_bp.route('/members/<int:member_id>', methods=['DELETE'])
@role_required(['leader'])
def delete_member(member_id):
    """حذف العضو (للقائد فقط)"""
    try:
        member = Member.query.filter_by(id=member_id, is_active=True).first()
        if not member:
            return jsonify({'error': 'العضو غير موجود'}), 404
        
        member.is_active = False
        
        points = Point.query.filter_by(member_id=member.id).all()
        for point in points:
            point.is_active = False
        
        log_entry = Log(
            action_type=LOG_ACTIONS['DELETE'],
            target_type=LOG_TARGETS['MEMBER'],
            target_id=member.id,
            details=f'تم حذف العضو: {member.name}',
            created_by=session['user_id']
        )
        db.session.add(log_entry)
        db.session.commit()
        
        return jsonify({'message': 'تم حذف العضو بنجاح'}), 200
        
    except Exception as e:
        return jsonify({'error': f'حدث خطأ: {str(e)}'}), 500

@members_bp.route('/categories', methods=['GET'])
@login_required
def get_categories():
    """الحصول على فئات النقاط"""
    return jsonify({
        'positive_categories': POSITIVE_CATEGORIES,
        'negative_categories': NEGATIVE_CATEGORIES
    }), 200

