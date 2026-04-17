"""Auth router — login, setup, session management."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import LoginRequest, LoginResponse, SetupRequest
from ..auth import hash_password, verify_password, create_access_token, is_setup_complete, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    """Check if setup is complete and user is configured."""
    return {"setup_complete": is_setup_complete(db)}


@router.post("/setup")
def setup(req: SetupRequest, db: Session = Depends(get_db)):
    """Initial user setup — only works if no user exists yet."""
    if is_setup_complete(db):
        raise HTTPException(status_code=400, detail="Setup already complete")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.username})
    return LoginResponse(token=token, username=user.username)


@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    if not is_setup_complete(db):
        raise HTTPException(status_code=400, detail="Setup not complete")

    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(data={"sub": user.username})

    # Set cookie as well for browser convenience
    response.set_cookie(
        key="budget_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400,
    )

    return LoginResponse(token=token, username=user.username)


@router.post("/logout")
def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie("budget_token")
    return {"message": "Logged out"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    """Get current user info."""
    return {"username": user.username, "id": user.id}
