from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass
class Employee:
    id: int
    employee_code: str
    full_name: str
    department: str | None
    embedding_count: int
    created_at: str


@dataclass
class Match:
    employee_code: str
    full_name: str
    department: str | None
    similarity: float


class Store(ABC):
    @abstractmethod
    async def init(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def upsert_employee(
        self, employee_code: str, full_name: str, department: str | None
    ) -> int:
        """Insert or update an employee, returning its id."""

    @abstractmethod
    async def add_embedding(self, employee_id: int, embedding: np.ndarray) -> None: ...

    @abstractmethod
    async def best_match(self, embedding: np.ndarray) -> Match | None:
        """Nearest neighbor by cosine similarity, or None if no embeddings exist."""

    @abstractmethod
    async def list_employees(self) -> list[Employee]: ...

    @abstractmethod
    async def delete_employee(self, employee_code: str) -> bool: ...
