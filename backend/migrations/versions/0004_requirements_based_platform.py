"""requirements based platform models and columns

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-07 03:20:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create documents table
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.String(length=20), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('purpose', sa.String(length=40), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('status', sa.String(length=20), index=True, nullable=False, server_default='uploaded'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('extracted_text', sa.Text(), nullable=False, server_default=''),
        sa.Column('metadata_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 2. Create requirement_clarifications table
    op.create_table(
        'requirement_clarifications',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('requirement_id', sa.Integer(), sa.ForeignKey('requirements.id', ondelete='CASCADE'), index=True, nullable=True),
        sa.Column('type', sa.String(length=40), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('context', sa.Text(), nullable=False, server_default=''),
        sa.Column('impact', sa.Text(), nullable=False, server_default=''),
        sa.Column('suggested_resolution', sa.Text(), nullable=True),
        sa.Column('user_response', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), index=True, nullable=False, server_default='open'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
    )

    # 3. Create simulation_models table
    op.create_table(
        'simulation_models',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('project_id', sa.Integer(), sa.ForeignKey('projects.id', ondelete='CASCADE'), index=True, nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('version', sa.String(length=20), nullable=False, server_default='1.0'),
        sa.Column('domain', sa.String(length=100), nullable=False, server_default=''),
        sa.Column('definition_json', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(length=20), index=True, nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # 4. Alter projects table
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('project_type', sa.String(length=30), nullable=False, server_default='requirements_based'))
        batch_op.add_column(sa.Column('business_domain', sa.String(length=100), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('product_type', sa.String(length=100), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('target_users_and_roles', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('objectives', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('business_scenarios', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('functional_expectations', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('non_functional_expectations', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('constraints_and_assumptions', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('explicit_exclusions', sa.JSON(), nullable=False, server_default='[]'))

    # Mark existing projects as 'code_based'
    op.execute("UPDATE projects SET project_type = 'code_based' WHERE key IN ('ECHO', 'CUREON') OR key LIKE 'DF%'")

    # 5. Alter requirements table
    with op.batch_alter_table('requirements', schema=None) as batch_op:
        batch_op.add_column(sa.Column('document_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('source_section', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('source_page', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('evidence_excerpt', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('related_scenario', sa.String(length=200), nullable=True))
        batch_op.add_column(sa.Column('dependencies', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('extraction_provenance', sa.String(length=30), nullable=False, server_default='explicit_documented'))
        batch_op.add_column(sa.Column('review_status', sa.String(length=30), nullable=False, server_default='pending_review'))

    # 6. Alter acceptance_criteria table
    with op.batch_alter_table('acceptance_criteria', schema=None) as batch_op:
        batch_op.add_column(sa.Column('actor', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('action', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('input_conditions', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('expected_output', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('business_rules', sa.JSON(), nullable=False, server_default='[]'))

    # 7. Alter test_cases table
    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.add_column(sa.Column('test_category', sa.String(length=40), nullable=False, server_default='positive'))
        batch_op.add_column(sa.Column('execution_capability', sa.String(length=40), nullable=False, server_default='specification_validation'))
        batch_op.add_column(sa.Column('approval_status', sa.String(length=30), nullable=False, server_default='draft'))
        batch_op.add_column(sa.Column('steps_json', sa.JSON(), nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('generation_provenance', sa.String(length=50), nullable=False, server_default='ai_generated'))

    # 8. Alter executions table
    with op.batch_alter_table('executions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('model_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('execution_type', sa.String(length=30), nullable=False, server_default='simulation'))


def downgrade() -> None:
    with op.batch_alter_table('executions', schema=None) as batch_op:
        batch_op.drop_column('execution_type')
        batch_op.drop_column('model_id')

    with op.batch_alter_table('test_cases', schema=None) as batch_op:
        batch_op.drop_column('generation_provenance')
        batch_op.drop_column('steps_json')
        batch_op.drop_column('approval_status')
        batch_op.drop_column('execution_capability')
        batch_op.drop_column('test_category')

    with op.batch_alter_table('acceptance_criteria', schema=None) as batch_op:
        batch_op.drop_column('business_rules')
        batch_op.drop_column('expected_output')
        batch_op.drop_column('input_conditions')
        batch_op.drop_column('action')
        batch_op.drop_column('actor')

    with op.batch_alter_table('requirements', schema=None) as batch_op:
        batch_op.drop_column('review_status')
        batch_op.drop_column('extraction_provenance')
        batch_op.drop_column('dependencies')
        batch_op.drop_column('related_scenario')
        batch_op.drop_column('evidence_excerpt')
        batch_op.drop_column('source_page')
        batch_op.drop_column('source_section')
        batch_op.drop_column('document_id')

    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('explicit_exclusions')
        batch_op.drop_column('constraints_and_assumptions')
        batch_op.drop_column('non_functional_expectations')
        batch_op.drop_column('functional_expectations')
        batch_op.drop_column('business_scenarios')
        batch_op.drop_column('objectives')
        batch_op.drop_column('target_users_and_roles')
        batch_op.drop_column('product_type')
        batch_op.drop_column('business_domain')
        batch_op.drop_column('project_type')

    op.drop_table('simulation_models')
    op.drop_table('requirement_clarifications')
    op.drop_table('documents')
