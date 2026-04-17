"""Tests for auth endpoints — setup, login, logout, token validation."""
import pytest


class TestAuthStatus:
    def test_status_before_setup(self, client):
        """Auth status shows setup_complete=false when no user exists."""
        resp = client.get("/api/auth/status")
        assert resp.status_code == 200
        assert resp.json()["setup_complete"] is False

    def test_status_after_setup(self, client, test_user):
        """Auth status shows setup_complete=true after user created."""
        resp = client.get("/api/auth/status")
        assert resp.status_code == 200
        assert resp.json()["setup_complete"] is True


class TestSetup:
    def test_setup_creates_user(self, client):
        """Initial setup creates user and returns token."""
        resp = client.post("/api/auth/setup", json={
            "username": "newuser",
            "password": "securepass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["username"] == "newuser"

    def test_setup_duplicate_prevention(self, client, test_user):
        """Cannot run setup when a user already exists."""
        resp = client.post("/api/auth/setup", json={
            "username": "anotheruser",
            "password": "securepass123",
        })
        assert resp.status_code == 400
        assert "already complete" in resp.json()["detail"].lower()

    def test_setup_short_username(self, client):
        """Username must be at least 3 characters."""
        resp = client.post("/api/auth/setup", json={
            "username": "ab",
            "password": "securepass123",
        })
        assert resp.status_code == 422

    def test_setup_short_password(self, client):
        """Password must be at least 8 characters."""
        resp = client.post("/api/auth/setup", json={
            "username": "validuser",
            "password": "short",
        })
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client, test_user):
        """Valid credentials return a JWT token."""
        resp = client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["username"] == "testuser"

    def test_login_invalid_password(self, client, test_user):
        """Wrong password returns 401."""
        resp = client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()

    def test_login_nonexistent_user(self, client, test_user):
        """Unknown username returns 401."""
        resp = client.post("/api/auth/login", json={
            "username": "noone",
            "password": "testpass123",
        })
        assert resp.status_code == 401

    def test_login_before_setup(self, client):
        """Cannot log in when no user has been set up."""
        resp = client.post("/api/auth/login", json={
            "username": "ghost",
            "password": "password123",
        })
        assert resp.status_code == 400
        assert "setup" in resp.json()["detail"].lower()

    def test_login_sets_cookie(self, client, test_user):
        """Successful login sets an httponly cookie."""
        resp = client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        assert "budget_token" in resp.cookies


class TestLogout:
    def test_logout(self, client):
        """Logout clears the cookie and returns success."""
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 200
        assert resp.json()["message"] == "Logged out"


class TestMe:
    def test_me_authenticated(self, client, auth_headers, test_user):
        """Authenticated user can access /me."""
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "testuser"
        assert data["id"] == test_user.id

    def test_me_no_token(self, client):
        """/me without token returns 401."""
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_invalid_token(self, client):
        """/me with a bogus token returns 401."""
        resp = client.get("/api/auth/me", headers={
            "Authorization": "Bearer totally-invalid-jwt-token"
        })
        assert resp.status_code == 401


class TestProtectedRoutes:
    """Verify that protected routes reject unauthenticated requests."""

    @pytest.mark.parametrize("method,url", [
        ("GET", "/api/accounts"),
        ("GET", "/api/categories"),
        ("GET", "/api/rules"),
        ("GET", "/api/transactions"),
        ("GET", "/api/dashboard"),
        ("GET", "/api/trends"),
        ("GET", "/api/export/full"),
    ])
    def test_protected_route_requires_auth(self, client, method, url):
        resp = client.request(method, url)
        assert resp.status_code == 401
