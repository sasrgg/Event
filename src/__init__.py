from flask import Flask
from flask_login import LoginManager
import os

from .models import db

login_manager = LoginManager()
login_manager.login_view = 'auth_bp.login'


@login_manager.user_loader
def load_user(user_id):
    from .models.user import User
    return User.query.get(int(user_id))


def create_app():
    """
    ???? ????? ??????? (Application Factory).
    ??? ?? ????? ?????? ?? Flask ????? ????????? ???????.
    """
    app = Flask(__name__,
                static_folder='../static',
                template_folder='../static')

    app.config['SECRET_KEY'] = 'your-super-secret-key-for-sessions'

    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'database', 'app.db')

    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    login_manager.init_app(app)

    from .routes.user import user_bp
    from .routes.auth import auth_bp
    from .routes.members import members_bp
    from .routes.points import points_bp

    app.register_blueprint(user_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(members_bp)
    app.register_blueprint(points_bp)

    return app
