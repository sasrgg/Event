USER_ROLES = {'LEADER': 'leader', 'CO_LEADER': 'co_leader', 'VISOR': 'visor'}

POINT_TYPES = {'POSITIVE': 'إيجابية', 'NEGATIVE': 'سلبية'}

POSITIVE_CATEGORIES = {
    'CHAT_ACTIVITY': 'فعالية في الشات العام',
    'EVENT_ATTENDANCE': 'حضور فعالية',
    'EVENT_DESIGN': 'تصميم فعالية',
    'EVENT_IDEA': 'فكرة فعالية',
    'Daily_top': 'توب يومي',
    'OTHER': 'أخرى'
}

NEGATIVE_CATEGORIES = {
    'WEAK_INTERACTION': 'تفاعل ضعيف',
    'MISSED_MEETING': 'عدم حضور اجتماع',
    'DESIGN_SHORTCOMING': 'تقصير في التصميم',
    'INAPPROPRIATE_BEHAVIOR': 'سلوك غير لائق',
    'Absence_without_excuse': 'غياب بدون عذر',
    'OTHER': 'أخرى'
}

LOG_ACTIONS = {
    'CREATE': 'create',
    'UPDATE': 'update',
    'DELETE': 'delete',
    'LOGIN': 'login',
    'LOGOUT': 'logout',
    'PASSWORD_CHANGE': 'password_change',
    'reactivate': 'reactivate'
}

LOG_TARGETS = {'USER': 'user', 'MEMBER': 'member', 'POINT': 'point'}

DEFAULT_ADMIN = {
    'username': 'Gon',
    'password': '123',
    'role': USER_ROLES['LEADER']
}
