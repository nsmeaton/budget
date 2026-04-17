"""Tests for categories and category groups CRUD."""
import pytest
from budget.backend.seed import DEFAULT_CATEGORIES


class TestSeededCategories:
    """Verify the default seed data."""

    def test_seeded_groups_exist(self, client, auth_headers, seeded_db, test_user):
        """All default category groups are seeded."""
        resp = client.get("/api/categories/groups", headers=auth_headers)
        assert resp.status_code == 200
        groups = resp.json()
        group_names = {g["name"] for g in groups}
        for expected_group in DEFAULT_CATEGORIES:
            assert expected_group in group_names

    def test_seeded_categories_exist(self, client, auth_headers, seeded_db, test_user):
        """All default categories are seeded."""
        resp = client.get("/api/categories", headers=auth_headers)
        assert resp.status_code == 200
        cats = resp.json()
        cat_names = {c["name"] for c in cats}
        # Check a handful of known categories
        for name in ["Groceries", "Eating Out", "Rent / Mortgage", "Salary", "Transfer"]:
            assert name in cat_names

    def test_seeded_categories_have_tiers(self, client, auth_headers, seeded_db, test_user):
        """Seeded categories have appropriate default tiers."""
        resp = client.get("/api/categories", headers=auth_headers)
        cats = {c["name"]: c for c in resp.json()}
        assert cats["Groceries"]["default_tier"] == "Essential"
        assert cats["Eating Out"]["default_tier"] == "Discretionary"
        assert cats["Clothing"]["default_tier"] == "Optional"
        assert cats["Savings"]["default_tier"] == "Savings"
        assert cats["Transfer"]["default_tier"] == "Transfer"

    def test_seed_idempotent(self, seeded_db):
        """Calling seed_categories again doesn't duplicate data."""
        from budget.backend.seed import seed_categories
        from budget.backend.models import CategoryGroup
        seed_categories(seeded_db)
        count = seeded_db.query(CategoryGroup).count()
        assert count == len(DEFAULT_CATEGORIES)


class TestListCategories:
    def test_empty_list(self, client, auth_headers):
        """No categories returns empty list."""
        resp = client.get("/api/categories", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_flat(self, client, auth_headers, sample_category):
        """Flat category list returns all categories."""
        resp = client.get("/api/categories", headers=auth_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Groceries"
        assert data[0]["group_name"] == "Test Group"


class TestListGroups:
    def test_empty_groups(self, client, auth_headers):
        resp = client.get("/api/categories/groups", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_groups_with_categories(self, client, auth_headers, sample_category, sample_category_group):
        """Groups include nested categories."""
        resp = client.get("/api/categories/groups", headers=auth_headers)
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Group"
        assert len(data[0]["categories"]) == 1
        assert data[0]["categories"][0]["name"] == "Groceries"


class TestCreateCategory:
    def test_create(self, client, auth_headers, sample_category_group):
        """Create a new category."""
        resp = client.post("/api/categories", json={
            "group_id": sample_category_group.id,
            "name": "Takeaway",
            "default_tier": "Discretionary",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Takeaway"
        assert data["default_tier"] == "Discretionary"
        assert data["group_id"] == sample_category_group.id

    def test_create_no_tier(self, client, auth_headers, sample_category_group):
        """Category without a default tier is allowed."""
        resp = client.post("/api/categories", json={
            "group_id": sample_category_group.id,
            "name": "Misc",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["default_tier"] is None

    def test_create_invalid_group(self, client, auth_headers):
        """Creating a category with non-existent group returns 404."""
        resp = client.post("/api/categories", json={
            "group_id": 9999,
            "name": "Orphan",
        }, headers=auth_headers)
        assert resp.status_code == 404


class TestUpdateCategory:
    def test_update_name(self, client, auth_headers, sample_category):
        resp = client.put(f"/api/categories/{sample_category.id}", json={
            "name": "Supermarket",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Supermarket"

    def test_update_tier(self, client, auth_headers, sample_category):
        resp = client.put(f"/api/categories/{sample_category.id}", json={
            "default_tier": "Optional",
        }, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["default_tier"] == "Optional"

    def test_update_nonexistent(self, client, auth_headers):
        resp = client.put("/api/categories/9999", json={"name": "X"}, headers=auth_headers)
        assert resp.status_code == 404


class TestDeleteCategory:
    def test_delete(self, client, auth_headers, sample_category):
        resp = client.delete(f"/api/categories/{sample_category.id}", headers=auth_headers)
        assert resp.status_code == 200

        listing = client.get("/api/categories", headers=auth_headers)
        assert listing.json() == []

    def test_delete_nonexistent(self, client, auth_headers):
        resp = client.delete("/api/categories/9999", headers=auth_headers)
        assert resp.status_code == 404


class TestCreateGroup:
    def test_create(self, client, auth_headers):
        resp = client.post("/api/categories/groups", json={
            "name": "New Group",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "New Group"
        assert data["categories"] == []


class TestDeleteGroup:
    def test_delete(self, client, auth_headers, sample_category_group):
        resp = client.delete(f"/api/categories/groups/{sample_category_group.id}", headers=auth_headers)
        assert resp.status_code == 200

    def test_delete_cascades_categories(self, client, auth_headers, sample_category, db_session):
        """Deleting a group also removes its categories."""
        from budget.backend.models import Category
        group_id = sample_category.group_id
        resp = client.delete(f"/api/categories/groups/{group_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert db_session.query(Category).filter(Category.group_id == group_id).count() == 0

    def test_delete_nonexistent(self, client, auth_headers):
        resp = client.delete("/api/categories/groups/9999", headers=auth_headers)
        assert resp.status_code == 404
