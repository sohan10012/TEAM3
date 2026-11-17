"""reasonx tasks schema

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-17 22:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'reasonx_tasks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('conversation_id', sa.Integer(), sa.ForeignKey('reasonx_conversations.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('task_type', sa.String(length=50), nullable=False, server_default='general_query'),
        sa.Column('title', sa.String(length=255), nullable=False, server_default='ReasonX Task'),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='completed'),
        sa.Column('risk_level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('plan', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('steps', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('pending_action', sa.JSON(), nullable=True),
        sa.Column('result_summary', sa.JSON(), nullable=True),
        sa.Column('evidence', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('reasonx_tasks')

