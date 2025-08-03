import sys
import os

# إضافة مسار المشروع إلى sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# تعيين ترميز UTF-8 للتعامل مع النصوص العربية
os.environ['PYTHONIOENCODING'] = 'utf-8'

from src.main import app

# تصدير التطبيق للاستخدام مع Vercel
app = app

# للاستخدام المحلي
if __name__ == "__main__":
    app.run(debug=True)
