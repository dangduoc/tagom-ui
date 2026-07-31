"""Depositor profiles, weigh sessions and station totals."""

BASE = 12480.5  # config.COMMUNITY_BASE_KG default


def register(client, code="0901234567", name="Chị Lan Nguyễn", **profile):
    return client.post("/api/people", json={"code": code, "full_name": name, **profile})


def test_register_and_read_back_a_person(client):
    res = register(
        client,
        phone="090 ••• 67",
        age="58",
        city="TP. Hồ Chí Minh",
        ward="Phường Bến Nghé",
        address="12 Nguyễn Huệ",
        citizen_id="079 •••• 231",
    )
    assert res.status_code == 200

    body = client.get("/api/people/0901234567").json()
    person = body["person"]
    assert person["full_name"] == "Chị Lan Nguyễn"
    assert person["age"] == "58"
    assert person["address"] == "12 Nguyễn Huệ"
    assert person["has_face_data"] is False
    assert body["sessions"] == []
    assert body["personal_total"] == 0
    assert person["member_since"]


def test_unknown_person_is_404(client):
    assert client.get("/api/people/nobody").status_code == 404


def test_roster_lists_people_and_delete_removes_them(client):
    register(client, code="0901234567", name="Chị Lan Nguyễn")
    register(client, code="0907654321", name="Anh Minh Trần")

    roster = client.get("/api/people").json()
    assert {p["code"] for p in roster} == {"0901234567", "0907654321"}
    assert all(p["embedding_count"] == 0 for p in roster)

    assert client.delete("/api/people/0901234567").status_code == 200
    assert client.get("/api/people/0901234567").status_code == 404
    assert [p["code"] for p in client.get("/api/people").json()] == ["0907654321"]

    assert client.delete("/api/people/0901234567").status_code == 404


def test_partial_update_leaves_other_fields_alone(client):
    register(client, phone="090 ••• 67", city="TP. Hồ Chí Minh", age="58")

    res = client.put("/api/people/0901234567", json={"age": "59"})
    assert res.status_code == 200

    person = res.json()["person"]
    assert person["age"] == "59"
    # Omitted fields must survive — enrolment and profile edits share one upsert.
    assert person["city"] == "TP. Hồ Chí Minh"
    assert person["phone"] == "090 ••• 67"
    assert person["full_name"] == "Chị Lan Nguyễn"


def test_a_field_can_be_cleared_with_an_empty_string(client):
    register(client, address="12 Nguyễn Huệ")
    person = client.put("/api/people/0901234567", json={"address": ""}).json()["person"]
    assert person["address"] == ""


def test_session_is_attributed_and_totalled(client):
    register(client)

    res = client.post(
        "/api/sessions",
        json={
            "code": "0901234567",
            "items": [
                {"category": "nhua", "weight": 3.24},
                {"category": "giay", "weight": 1.82},
            ],
        },
    )
    assert res.status_code == 200
    assert res.json()["total"] == 5.06
    assert res.json()["community_total"] == round(BASE + 5.06, 2)

    body = client.get("/api/people/0901234567").json()
    assert body["session_count"] == 1
    assert body["personal_total"] == 5.06
    session = body["sessions"][0]
    assert session["total"] == 5.06
    assert [i["category"] for i in session["items"]] == ["nhua", "giay"]


def test_history_is_newest_first(client):
    register(client)
    for weight in (1.0, 2.0, 3.0):
        client.post(
            "/api/sessions",
            json={"code": "0901234567", "items": [{"category": "nhua", "weight": weight}]},
        )

    body = client.get("/api/people/0901234567").json()
    assert body["session_count"] == 3
    assert body["personal_total"] == 6.0
    # Same-second timestamps, so id breaks the tie — newest still comes first.
    assert [s["total"] for s in body["sessions"]] == [3.0, 2.0, 1.0]


def test_anonymous_session_counts_for_the_station_but_nobody_owns_it(client):
    register(client)
    res = client.post(
        "/api/sessions",
        json={"code": None, "items": [{"category": "chuaphanloai", "weight": 4.5}]},
    )
    assert res.status_code == 200
    assert res.json()["community_total"] == round(BASE + 4.5, 2)

    # The registered person didn't get credited with it.
    assert client.get("/api/people/0901234567").json()["personal_total"] == 0
    assert client.get("/api/stats").json()["community_total"] == round(BASE + 4.5, 2)


def test_session_for_an_unknown_person_is_rejected(client):
    res = client.post(
        "/api/sessions",
        json={"code": "nobody", "items": [{"category": "nhua", "weight": 1.0}]},
    )
    assert res.status_code == 404


def test_bad_sessions_are_rejected(client):
    def post(payload):
        return client.post("/api/sessions", json=payload).status_code

    assert post({"code": None, "items": [{"category": "gold", "weight": 1.0}]}) == 422
    assert post({"code": None, "items": [{"category": "nhua", "weight": -1.0}]}) == 422
    assert post({"code": None, "items": [{"category": "nhua", "weight": 10_000}]}) == 422
    assert post({"code": None, "items": []}) == 422

    # None of it landed.
    assert client.get("/api/stats").json()["community_total"] == BASE


def test_stats_reports_the_station_baseline(client):
    body = client.get("/api/stats").json()
    assert body["community_total"] == BASE
    assert body["community_base"] == BASE
    assert body["community_goal"] == 15000
