from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


@dataclass
class Match:
    code: str
    full_name: str
    department: str | None
    similarity: float


@dataclass
class Profile:
    """Depositor details collected at the station's register screen.

    `None` means "not supplied, leave whatever is stored"; an empty string
    clears the field. That lets enrollment (photos only) and a profile edit
    share one upsert without either wiping the other's data.
    """

    phone: str | None = None
    age: str | None = None
    city: str | None = None
    ward: str | None = None
    address: str | None = None
    citizen_id: str | None = None


@dataclass
class Person:
    id: int
    code: str
    full_name: str
    department: str | None
    created_at: str
    embedding_count: int = 0
    profile: Profile = field(default_factory=Profile)


@dataclass
class SessionItem:
    category: str
    weight: float  # kg


@dataclass
class WeighSession:
    id: int
    created_at: str
    items: list[SessionItem]

    @property
    def total(self) -> float:
        return round(sum(i.weight for i in self.items), 2)


class Store(ABC):
    @abstractmethod
    async def init(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def upsert_person(
        self,
        code: str,
        full_name: str,
        department: str | None,
        profile: "Profile | None" = None,
    ) -> int:
        """Insert or update a person, returning their id.

        Only non-None profile fields are written, so enrolling photos never
        clears details captured earlier (and vice versa).
        """

    @abstractmethod
    async def get_person(self, code: str) -> "Person | None": ...

    @abstractmethod
    async def list_people(self) -> list["Person"]: ...

    @abstractmethod
    async def delete_person(self, code: str) -> bool: ...

    @abstractmethod
    async def add_session(self, code: str | None, items: list["SessionItem"]) -> int:
        """Record a finished weigh session. `None` code = anonymous — the weights
        still count towards the station total, they're just not attributed."""

    @abstractmethod
    async def sessions_for(self, code: str) -> list["WeighSession"]:
        """This person's sessions, newest first."""

    @abstractmethod
    async def community_total(self) -> float:
        """Every kilogram recorded at this station, including anonymous ones."""

    @abstractmethod
    async def add_embedding(self, person_id: int, embedding: np.ndarray) -> None: ...

    @abstractmethod
    async def best_match(self, embedding: np.ndarray) -> Match | None:
        """Nearest neighbor by cosine similarity, or None if no embeddings exist."""
