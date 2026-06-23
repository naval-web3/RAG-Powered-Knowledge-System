"""
Create (or promote) an admin user.

Usage (from the backend/ directory, venv active):
    python -m scripts.seed_admin --email admin@example.com --username admin --password secret123
"""

import argparse

from app.database import SessionLocal, Base, engine
from app.models import User
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            user.role = "admin"
            user.password_hash = hash_password(args.password)
            print(f"Promoted existing user {args.email} to admin.")
        else:
            user = User(
                username=args.username,
                email=args.email,
                password_hash=hash_password(args.password),
                role="admin",
            )
            db.add(user)
            print(f"Created admin user {args.email}.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
