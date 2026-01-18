import sys
import os

# Add current directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.db import engine
from sqlalchemy import text, inspect

def migrate():
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    columns_to_add = [
        ('pending_reward_balance', 'INTEGER DEFAULT 0'),
        ('is_recycling_blacklisted', 'BOOLEAN DEFAULT FALSE'),
        ('is_water_blacklisted', 'BOOLEAN DEFAULT FALSE'),
        ('recycling_fraud_warnings_remaining', 'INTEGER DEFAULT 2'),
        ('water_fraud_warnings_remaining', 'INTEGER DEFAULT 2'),
    ]
    
    with engine.connect() as conn:
        for col_name, col_type in columns_to_add:
            if col_name not in columns:
                print(f"Column '{col_name}' not found. Adding it...")
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    print(f"  Added '{col_name}' successfully.")
                except Exception as e:
                    print(f"  Error adding '{col_name}': {e}")
            else:
                print(f"Column '{col_name}' already exists. Skipping.")
    
    print("\nMigration complete!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"Migration failed: {e}")
