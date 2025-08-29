import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
# 55
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager

from src.models.user import db, User
from src.models.init_data import init_default_data
from src.routes.user import user_bp
from src.routes.auth import auth_bp
from src.routes.members import members_bp
from src.routes.points import points_bp
from src.routes.admin import admin_bp
from src.models.init_data import init_default_data, create_sample_data


app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'event_team_manager_secret_key_2024'
app.config['SESSION_COOKIE_SECURE'] = False  # تعطيل HTTPS requirement للتطوير
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # تغيير إلى Lax للتوافق
app.config['SESSION_COOKIE_HTTPONLY'] = True  # حماية إضافية
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 ساعة

CORS(app, supports_credentials=True)
login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):

    return User.query.get(int(user_id))

app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(members_bp, url_prefix='/api')
app.register_blueprint(points_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')

# استخدام PostgreSQL على Neon.tech
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'postgresql://postgres.iycscmqemurdmdkusrau:Sasrggs1smb1@aws-1-eu-central-1.pooler.supabase.com:6543/postgres')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()
    init_default_data() 

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404

