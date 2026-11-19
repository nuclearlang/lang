from __future__ import annotations

from synapsis import Model


class Question(Model):
    text: str


class Answer(Model):
    text: str
