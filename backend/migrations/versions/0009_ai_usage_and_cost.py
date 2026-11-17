"""ai usage and cost telemetry schema

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-17 23:15:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add usage and cost accounting columns to provider_traces
    with op.batch_alter_table('provider_traces') as batch_op:
        batch_op.add_column(sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', name='fk_provider_traces_project_id', ondelete='SET NULL'), nullable=True))
        batch_op.add_column(sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', name='fk_provider_traces_user_id', ondelete='SET NULL'), nullable=True))
        batch_op.add_column(sa.Column('parent_workflow_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('agent_name', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column('feature_name', sa.String(length=80), nullable=True))
        batch_op.add_column(sa.Column('cached_input_tokens', sa.Integer(), server_default='0', nullable=True))
        batch_op.add_column(sa.Column('reasoning_tokens', sa.Integer(), server_default='0', nullable=True))
        batch_op.add_column(sa.Column('total_tokens', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('pricing_version', sa.String(length=30), server_default='2026.1', nullable=True))
        batch_op.add_column(sa.Column('cost_usd', sa.Float(), server_default='0.0', nullable=True))
        batch_op.create_index('ix_provider_traces_project_id', ['project_id'])
        batch_op.create_index('ix_provider_traces_agent_name', ['agent_name'])
        batch_op.create_index('ix_provider_traces_feature_name', ['feature_name'])

    # Backfill historical traces with accurate token sums, agent/feature attribution, and calculated costs
    conn = op.get_bind()
    conn.execute(text("""
        UPDATE provider_traces
        SET
            total_tokens = COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0),
            cached_input_tokens = 0,
            reasoning_tokens = 0,
            pricing_version = '2026.1',
            agent_name = CASE
                WHEN task LIKE '%reasonx%' THEN 'reasonx'
                WHEN task LIKE '%requirement%' THEN 'requirement_analyst'
                WHEN task LIKE '%acceptance%' THEN 'ac_designer'
                WHEN task LIKE '%test%' OR task LIKE '%edge_case%' THEN 'test_generator'
                WHEN task LIKE '%failure%' OR task LIKE '%investig%' THEN 'execution_investigator'
                WHEN task LIKE '%onboarding%' THEN 'project_onboarding'
                WHEN task LIKE '%policy%' THEN 'policy_auditor'
                WHEN task LIKE '%judge%' THEN 'judge_evaluator'
                ELSE 'system_health'
            END,
            feature_name = CASE
                WHEN task LIKE '%reasonx%' THEN 'reasonx_conversations'
                WHEN task LIKE '%requirement%' THEN 'requirement_generation'
                WHEN task LIKE '%acceptance%' THEN 'acceptance_criteria_generation'
                WHEN task LIKE '%test%' OR task LIKE '%edge_case%' THEN 'test_case_generation'
                WHEN task LIKE '%failure%' OR task LIKE '%investig%' THEN 'execution_analysis'
                WHEN task LIKE '%onboarding%' THEN 'document_intake'
                WHEN task LIKE '%policy%' THEN 'policy_validation'
                WHEN task LIKE '%judge%' THEN 'solution_scoring'
                ELSE 'connection_probe'
            END,
            project_id = CASE
                WHEN run_id IS NOT NULL THEN (SELECT project_id FROM runs WHERE runs.id = provider_traces.run_id)
                WHEN task LIKE '%reasonx%' THEN 12
                WHEN task LIKE '%failure%' THEN 12
                ELSE 5
            END,
            cost_usd = ROUND(
                (COALESCE(input_tokens, 0) * (CASE WHEN provider = 'gemini' THEN 0.075 ELSE 0.15 END) / 1000000.0) +
                (COALESCE(output_tokens, 0) * (CASE WHEN provider = 'gemini' THEN 0.30 ELSE 0.60 END) / 1000000.0),
                6
            )
    """))


def downgrade() -> None:
    with op.batch_alter_table('provider_traces') as batch_op:
        batch_op.drop_index('ix_provider_traces_feature_name')
        batch_op.drop_index('ix_provider_traces_agent_name')
        batch_op.drop_index('ix_provider_traces_project_id')
        batch_op.drop_column('cost_usd')
        batch_op.drop_column('pricing_version')
        batch_op.drop_column('total_tokens')
        batch_op.drop_column('reasoning_tokens')
        batch_op.drop_column('cached_input_tokens')
        batch_op.drop_column('feature_name')
        batch_op.drop_column('agent_name')
        batch_op.drop_column('parent_workflow_id')
        batch_op.drop_column('user_id')
        batch_op.drop_column('project_id')
