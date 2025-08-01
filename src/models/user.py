from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import pytz

db = SQLAlchemy()

saudi_timezone = pytz.timezone('Asia/Riyadh')

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='visor')
    first_login = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(saudi_timezone))
    created_by = db.Column(db.Integer,
                           db.ForeignKey('users.id'),
                           nullable=True)
    is_active = db.Column(db.Boolean, default=True)

    created_users = db.relationship('User',
                                    backref=db.backref('creator',
                                                       remote_side=[id]))
    created_members = db.relationship('Member', backref='creator')
    created_points = db.relationship('Point', backref='creator')
    created_logs = db.relationship('Log', backref='creator')

    def __repr__(self):
        return f'<User {self.username}>'

    def set_password(self, password):
        """تشفير كلمة المرور"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """التحقق من كلمة المرور"""
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'first_login': self.first_login,
            'created_at':
            self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }


class Member(db.Model):
    __tablename__ = 'members'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(saudi_timezone))
    created_by = db.Column(db.Integer,
                           db.ForeignKey('users.id'),
                           nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    points = db.relationship('Point',
                             backref='member',
                             cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Member {self.name}>'

    def get_points_summary(self, start_date=None, end_date=None):
        """حساب ملخص النقاط للعضو"""
        query = self.points.filter(Point.is_active == True)

        if start_date:
            query = query.filter(Point.created_at >= start_date)
        if end_date:
            query = query.filter(Point.created_at <= end_date)

        points = query.all()

        positive_count = len([p for p in points if p.point_type == 'positive'])
        negative_count = len([p for p in points if p.point_type == 'negative'])

        return {
            'positive_count': positive_count,
            'negative_count': negative_count,
            'total_points': positive_count - negative_count
        }

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at':
            self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active
        }


class Point(db.Model):
    __tablename__ = 'points'

    id = db.Column(db.Integer, primary_key=True)
    member_id = db.Column(db.Integer,
                          db.ForeignKey('members.id'),
                          nullable=False)
    point_type = db.Column(db.String(10), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(saudi_timezone))
    created_by = db.Column(db.Integer,
                           db.ForeignKey('users.id'),
                           nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f'<Point {self.point_type} for {self.member.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'member_id': self.member_id,
            'member_name': self.member.name if self.member else None,
            'point_type': self.point_type,
            'category': self.category,
            'description': self.description,
            'created_at':
            self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        }


class Log(db.Model):
    __tablename__ = 'logs'

    id = db.Column(db.Integer, primary_key=True)
    action_type = db.Column(db.String(50), nullable=False)
    target_type = db.Column(db.String(20), nullable=False)
    target_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(saudi_timezone))
    created_by = db.Column(db.Integer,
                           db.ForeignKey('users.id'),
                           nullable=True)

    def __repr__(self):
        return f'<Log {self.action_type} {self.target_type}>'

    def to_dict(self):
        return {
            'id': self.id,
            'action_type': self.action_type,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'details': self.details,
            'created_at':
            self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        }
