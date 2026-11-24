"""Checks of the rule decorators of a model (@required, @email, @url): pydantic runs them after the type."""

from __future__ import annotations

import re

from pydantic_core import PydanticCustomError

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_URL = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)


def is_email(value: str | None) -> str | None:
    """The value, if it is an e-mail address (None passes: the field is optional)."""
    if value is not None and not _EMAIL.match(value):
        raise ValueError("must be an e-mail address")
    return value


def is_url(value: str | None) -> str | None:
    """The value, if it is an http(s) URL (None passes: the field is optional)."""
    if value is not None and not _URL.match(value):
        raise ValueError("must be a URL")
    return value


def is_given(value: object) -> object:
    """The value, unless it is an empty text: under @required, "" is not given, as a missing value is (the rule
    `required`, the same in every dialect; a text of at least one character is @minLength(1))."""
    if value == "":
        raise PydanticCustomError("nuclear_required", "is required")
    return value
