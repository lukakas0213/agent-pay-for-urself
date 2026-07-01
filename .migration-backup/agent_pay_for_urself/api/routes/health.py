"""Health-check route."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Return a simple process health signal."""

    return {"status": "ok"}
