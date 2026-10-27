import pytest

from aria_engine import split


@pytest.fixture(autouse=True)
def no_real_split_model(monkeypatch):
    """Tests never run Demucs (slow, downloads weights). Tests that need split mode
    fake split.separate themselves."""
    monkeypatch.setattr(split, "available", lambda: False)
