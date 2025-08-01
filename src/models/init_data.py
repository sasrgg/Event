from src.models.user import db, User, Log
from src.models.constants import DEFAULT_ADMIN, USER_ROLES, LOG_ACTIONS, LOG_TARGETS
from datetime import datetime
import os
from pytz import timezone

def init_default_data():
    """إنشاء البيانات الأولية للنظام"""
    
    admin_user = User.query.filter_by(username=DEFAULT_ADMIN["username"]).first()
    
    if not admin_user:
        saudi_timezone = timezone('Asia/Riyadh')
        current_time_saudi = datetime.now(saudi_timezone)

        admin_user = User(
            username=DEFAULT_ADMIN["username"],
            role=DEFAULT_ADMIN["role"],
            first_login=True,
            created_at=current_time_saudi,
            is_active=True
        )
        admin_user.set_password(DEFAULT_ADMIN["password"])
        
        db.session.add(admin_user)
        db.session.commit()
        

        log_entry = Log(
            action_type=LOG_ACTIONS["CREATE"],
            target_type=LOG_TARGETS["USER"],
            target_id=admin_user.id,
            details=f"تم إنشاء المستخدم الرئيسي: {admin_user.username}",
            created_by=admin_user.id
        )
        db.session.add(log_entry)
        db.session.commit()
        
        if os.environ.get("VERCEL") != "1":
            print(f"تم إنشاء المستخدم الرئيسي: {admin_user.username}")
    else:
        if os.environ.get("VERCEL") != "1":
            print(f"المستخدم الرئيسي موجود بالفعل: {admin_user.username}")
    
    return admin_user

def create_sample_data():
    """إنشاء بيانات تجريبية للاختبار"""
    
    admin_user = User.query.filter_by(username=DEFAULT_ADMIN["username"]).first()
    if not admin_user:
        admin_user = init_default_data()
    
    if os.environ.get("VERCEL") != "1":
        print("تم إعداد النظام بالمستخدم الرئيسي فقط")
