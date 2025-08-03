from datetime import datetime, timedelta

def get_saudi_now():
    """الحصول على الوقت الحالي بتوقيت السعودية (UTC+3)"""
    utc_now = datetime.utcnow()
    # إضافة 3 ساعات للحصول على التوقيت السعودي
    saudi_now = utc_now + timedelta(hours=3)
    return saudi_now

def get_saudi_date_range(period, start_date_str=None, end_date_str=None):
    """الحصول على نطاق التاريخ بتوقيت السعودية"""
    now = get_saudi_now()
    
    if period == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
    elif period == 'week':
        start_date = now - timedelta(days=7)
        end_date = now
    elif period == 'month':
        start_date = now - timedelta(days=30)
        end_date = now
    elif period == 'custom' and start_date_str and end_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
    else:
        # للفترات المخصصة أو جميع الأوقات
        start_date = None
        end_date = None
    
    return start_date, end_date

def format_saudi_datetime(dt):
    """تنسيق التاريخ والوقت بتوقيت السعودية للعرض"""
    if dt is None:
        return None
    
    # نفترض أن التاريخ محفوظ بالتوقيت السعودي
    return dt.strftime('%Y-%m-%d %H:%M:%S')

