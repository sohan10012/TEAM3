"""project intelligence report and reasonx ai conversation schema

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-09 12:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'project_intelligence_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('version_hash', sa.String(length=64), nullable=False, server_default=''),
        sa.Column('executive_summary', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('readiness_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('metrics_by_area', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('critical_gaps', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('document_analysis', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('requirements_analysis', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('ai_insights', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('test_design', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('policy_validation', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('execution_results', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('traceability', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('recommendations', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('generated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'reasonx_conversations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False, server_default='New Conversation'),
        sa.Column('page_context', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        'reasonx_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('conversation_id', sa.Integer(), sa.ForeignKey('reasonx_conversations.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('structured_payload', sa.JSON(), nullable=True),
        sa.Column('screen_context', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('reasonx_messages')
    op.drop_table('reasonx_conversations')
    op.drop_table('project_intelligence_reports')

