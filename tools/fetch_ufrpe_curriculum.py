from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path


BASE_URL = "https://sigs.ufrpe.br"
CURRICULUM_URL = (
    "https://sigs.ufrpe.br/sigaa/public/curso/curriculo.jsf"
    "?id=28230865&lc=pt_BR"
)
CURRICULUM_ID = "28110720"
OUTPUT = Path("src/data/curriculum.json")


def fetch(opener: urllib.request.OpenerDirector, url: str, data: dict[str, str] | None = None) -> str:
    encoded = None
    if data is not None:
        encoded = urllib.parse.urlencode(data).encode("iso-8859-1")

    request = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "User-Agent": "affix-curriculum-fetcher/0.1",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    with opener.open(request, timeout=30) as response:
        raw = response.read()
    return raw.decode("iso-8859-1", errors="replace")


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def find_view_command(index_html: str) -> str:
    pattern = rf"\{{'([^']+)':'\1','id':'{CURRICULUM_ID}'\}}"
    match = re.search(pattern, index_html)
    if not match:
        raise RuntimeError("Nao encontrei o comando JSF para abrir o curriculo SIN02.")
    return match.group(1)


def find_form_action(index_html: str) -> str:
    match = re.search(r'<form id="formCurriculosCurso".*?action="([^"]+)"', index_html, re.S)
    if not match:
        raise RuntimeError("Nao encontrei o formulario de curriculos no SIGAA.")
    return urllib.parse.urljoin(BASE_URL, html.unescape(match.group(1)))


def find_view_state(index_html: str) -> str:
    match = re.search(r'name="javax\.faces\.ViewState".*?value="([^"]+)"', index_html, re.S)
    if not match:
        raise RuntimeError("Nao encontrei o ViewState do JSF.")
    return html.unescape(match.group(1))


def extract_field(document: str, label: str) -> str:
    pattern = rf"<th[^>]*>\s*{label}\s*</th>\s*<td[^>]*>(.*?)</td>"
    match = re.search(pattern, document, re.S | re.I)
    return clean_text(match.group(1)) if match else ""


def extract_courses(section_html: str, semester: int | None) -> list[dict[str, object]]:
    rows = re.findall(r"<tr class=\"linha(?:Par|Impar)\">(.*?)</tr>", section_html, re.S)
    courses = []
    for row in rows:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)
        if len(cells) < 2:
            continue

        title = clean_text(cells[0])
        kind = clean_text(cells[1]).lower()
        match = re.match(r"([A-Z0-9]+)\s*-\s*(.*?)\s*-\s*(\d+)h$", title)
        if not match:
            continue

        code, name, hours = match.groups()
        courses.append(
            {
                "code": code,
                "name": name,
                "hours": int(hours),
                "semester": semester,
                "kind": "obrigatoria" if "obrigat" in kind else "optativa",
            }
        )
    return courses


def section(document: str, section_id: str) -> str:
    start = document.find(f'<div id="{section_id}"')
    if start == -1:
        return ""

    next_match = re.search(r'\n\s*<div id="(?:optativas|complementares|semestre\d+)"', document[start + 1 :])
    end = start + 1 + next_match.start() if next_match else document.find("</div>\n\t\t\t\t\t\t", start)
    return document[start:end]


def build_payload(document: str) -> dict[str, object]:
    courses: list[dict[str, object]] = []
    courses.extend(extract_courses(section(document, "optativas"), None))

    semesters = []
    for semester in range(1, 10):
        semester_courses = extract_courses(section(document, f"semestre{semester}"), semester)
        courses.extend(semester_courses)
        semesters.append({"number": semester, "courseCodes": [course["code"] for course in semester_courses]})

    return {
        "source": {
            "name": "SIGAA UFRPE - Estrutura Curricular SIN02",
            "url": CURRICULUM_URL,
            "retrievedAt": "2026-05-22",
        },
        "program": {
            "code": extract_field(document, r"C&oacute;digo:"),
            "name": "Bacharelado em Sistemas de Informacao",
            "institution": "UFRPE",
            "campus": "Recife",
            "curriculum": "SIN02",
            "modality": "Presencial",
            "shift": "Matutino",
            "effectiveTerm": extract_field(document, r"Per&iacute;odo Letivo de Entrada em Vigor:"),
            "minimumHours": 3090,
            "requiredElectiveHours": 480,
            "requiredComplementaryHours": 240,
            "semesters": 9,
        },
        "semesters": semesters,
        "courses": sorted(courses, key=lambda course: (course["semester"] or 99, course["code"])),
    }


def main() -> None:
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    index_html = fetch(opener, CURRICULUM_URL)
    document = fetch(
        opener,
        find_form_action(index_html),
        {
            "formCurriculosCurso": "formCurriculosCurso",
            "nivel": "G",
            find_view_command(index_html): find_view_command(index_html),
            "id": CURRICULUM_ID,
            "javax.faces.ViewState": find_view_state(index_html),
        },
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build_payload(document), ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
