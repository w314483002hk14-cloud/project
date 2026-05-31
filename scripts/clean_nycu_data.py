import json
import re
import unicodedata
import time
from difflib import SequenceMatcher
from collections import Counter
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
V4_PATH = DATA_DIR / "nycu_v4_merged.json"
SCHOOLS_FINAL_PATH = DATA_DIR / "nycu_schools_final.json"
OUTPUT_PATH = DATA_DIR / "nycu_191_clean.json"
AUDIT_PATH = DATA_DIR / "nycu_191_clean_audit.md"
GEOCODE_CACHE_PATH = DATA_DIR / "geocode_cache.json"

COUNTRY_HINTS = {
    "大陸地區": "China",
    "日本": "Japan",
    "韓國": "South Korea",
    "香港": "Hong Kong",
    "馬來西亞": "Malaysia",
    "新加坡": "Singapore",
    "泰國": "Thailand",
    "印尼": "Indonesia",
    "印度": "India",
    "中東地區": "Middle East",
    "歐洲": "Europe",
    "法國": "France",
    "德國": "Germany",
    "義大利": "Italy",
    "比利時": "Belgium",
    "捷克": "Czech Republic",
    "丹麥": "Denmark",
    "芬蘭": "Finland",
    "立陶宛": "Lithuania",
    "西班牙": "Spain",
    "紐西蘭": "New Zealand",
    "法屬玻里尼西亞": "French Polynesia",
    "加拿大": "Canada",
    "美國": "USA",
    "墨西哥": "Mexico",
}


def normalize_space(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_name(text: str) -> str:
    t = normalize_space(text).lower()
    t = "".join(ch for ch in unicodedata.normalize("NFKD", t) if not unicodedata.combining(ch))
    t = re.sub(r"\(.*?\)", "", t)
    t = t.replace("univeristy", "university")
    t = t.replace("universite", "universite")
    t = t.replace("'", "")
    t = t.replace("，", ",")
    t = t.replace("&", " and ")
    t = re.sub(r"[^\w\u4e00-\u9fff]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def normalize_country(text: str) -> str:
    return normalize_name(text)


def generate_name_keys(text: str):
    raw = normalize_space(text)
    if not raw:
        return set()

    keys = set()
    keys.add(normalize_name(raw))

    no_paren = re.sub(r"\(.*?\)", "", raw)
    keys.add(normalize_name(no_paren))

    if "," in raw:
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        for p in parts:
            keys.add(normalize_name(p))
        if len(parts) >= 2:
            keys.add(normalize_name(" ".join(parts)))

    if raw.lower().startswith("the "):
        keys.add(normalize_name(raw[4:]))

    return {k for k in keys if k}


def clean_text_field(value):
    if value is None:
        return ""
    s = str(value)
    s = normalize_space(s)
    s = s.replace(" | ", " | ")
    s = re.sub(r"\s*\|\s*", " | ", s)
    s = re.sub(r"\s*/\s*", "/", s)
    return s


def parse_quota_and_terms(quota_full: str):
    q = quota_full or ""
    qn = q.lower()

    has_fall_token = bool(re.search(r"fall|第一學期|1st", qn, re.IGNORECASE))
    has_spring_token = bool(re.search(r"spring|第二學期|2nd", qn, re.IGNORECASE))

    if has_fall_token or has_spring_token:
        term_fall = has_fall_token
        term_spring = has_spring_token
    else:
        term_fall = True
        term_spring = True

    unit = "student" if re.search(r"student|students", qn) else "semester"

    nums = [int(x) for x in re.findall(r"\b(\d{1,3})\b", q)]
    quota_fall = None
    quota_spring = None

    m_fall = re.search(r"fall[^\d]*(\d{1,3})", qn)
    if m_fall:
        quota_fall = int(m_fall.group(1))

    m_spring = re.search(r"spring[^\d]*(\d{1,3})", qn)
    if m_spring:
        quota_spring = int(m_spring.group(1))

    if quota_fall is None and quota_spring is None and nums:
        if len(nums) == 1:
            quota_fall = nums[0]
            quota_spring = nums[0]
        else:
            quota_fall = nums[0]
            quota_spring = nums[1]

    return {
        "term_fall": term_fall,
        "term_spring": term_spring,
        "quota_fall": quota_fall,
        "quota_spring": quota_spring,
        "quota_unit": unit,
    }


def extract_first_float(text: str):
    if not text:
        return None
    m = re.search(r"(\d(?:\.\d+)?)", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def parse_gpa(grade_full: str):
    g = grade_full or ""
    m = re.search(r"gpa\s*(\d(?:\.\d+)?)\s*/\s*(\d(?:\.\d+)?)", g, re.IGNORECASE)
    if m:
        return float(m.group(1)), float(m.group(2))

    m2 = re.search(r"gpa\s*(\d(?:\.\d+)?)", g, re.IGNORECASE)
    if m2:
        return float(m2.group(1)), 4.3

    return None, None


def parse_language(lang_full: str):
    l = lang_full or ""
    ibt = None
    ielts = None
    toeic = None
    jlpt = None

    m_ibt = re.search(r"(?:ibt|toefl\s*ibt)\s*(\d{2,3})", l, re.IGNORECASE)
    if m_ibt:
        ibt = int(m_ibt.group(1))

    m_ielts = re.search(r"ielts\s*(\d(?:\.\d+)?)", l, re.IGNORECASE)
    if m_ielts:
        ielts = float(m_ielts.group(1))

    m_toeic = re.search(r"toeic\s*(\d{3})", l, re.IGNORECASE)
    if m_toeic:
        toeic = int(m_toeic.group(1))

    m_jlpt = re.search(r"jlpt\s*N\s*([1-5])", l, re.IGNORECASE)
    if m_jlpt:
        jlpt = f"N{m_jlpt.group(1)}"

    return {
        "ibt_min": ibt,
        "ielts_min": ielts,
        "toeic_min": toeic,
        "jlpt_min_level": jlpt,
    }


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_geocode_cache(path: Path):
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def save_geocode_cache(path: Path, cache: dict):
    with path.open("w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def geocode_nominatim(query: str):
    url = f"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q={quote(query)}"
    req = Request(
        url,
        headers={
            "User-Agent": "nycu-dashboard-cleaner/1.0 (academic project)",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        if isinstance(payload, list) and payload:
            item = payload[0]
            lat = float(item.get("lat"))
            lng = float(item.get("lon"))
            return lat, lng
    except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return None
    return None


def build_query_candidates(rec):
    country_raw = normalize_space(rec.get("country", ""))
    country_hint = COUNTRY_HINTS.get(country_raw, country_raw)

    names = []
    for source in [rec.get("name", ""), rec.get("name_en", "")]:
        s = normalize_space(source)
        if s:
            names.append(s)
            names.append(re.sub(r"\(.*?\)", "", s).strip())
            if "," in s:
                names.extend([p.strip() for p in s.split(",") if p.strip()])

    dedup = []
    seen = set()
    for n in names:
        key = normalize_name(n)
        if key and key not in seen:
            seen.add(key)
            dedup.append(n)

    queries = []
    for n in dedup:
        if country_hint:
            queries.append(f"{n}, {country_hint}")
        queries.append(n)

    return queries


def build_coord_index(schools_final):
    idx = {}
    entries = []
    for row in schools_final:
        lat = row.get("lat", 0) or 0
        lng = row.get("lng", 0) or 0
        if not lat or not lng:
            continue

        keys = set()
        keys.update(generate_name_keys(str(row.get("name_en", ""))))
        keys.update(generate_name_keys(str(row.get("name_zh", ""))))
        if not keys:
            continue

        country_keys = set()
        country_keys.add(normalize_country(str(row.get("country_zh", ""))))
        country_keys.add(normalize_country(str(row.get("country_en", ""))))
        country_keys = {c for c in country_keys if c}

        for key in keys:
            if key:
                idx[key] = (float(lat), float(lng))

        entries.append(
            {
                "keys": keys,
                "country_keys": country_keys,
                "coord": (float(lat), float(lng)),
            }
        )

    return idx, entries


def fuzzy_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def resolve_coordinate(rec, coord_index, coord_entries, geocode_cache):
    rec_keys = set()
    rec_keys.update(generate_name_keys(rec.get("name", "")))
    rec_keys.update(generate_name_keys(rec.get("name_en", "")))
    rec_country = normalize_country(rec.get("country", ""))

    for key in rec_keys:
        if key in coord_index:
            return coord_index[key], "matched_from_schools_final"

    candidates = [e for e in coord_entries if (not rec_country or rec_country in e["country_keys"])]
    if not candidates:
        candidates = coord_entries

    for cand in candidates:
        if rec_keys & cand["keys"]:
            return cand["coord"], "matched_from_schools_final_country"

    best = None
    best_score = 0.0
    for cand in candidates:
        for rk in rec_keys:
            for ck in cand["keys"]:
                score = fuzzy_score(rk, ck)
                if score > best_score:
                    best_score = score
                    best = cand

    if best is not None and best_score >= 0.86:
        return best["coord"], f"matched_from_schools_final_fuzzy_{best_score:.2f}"

    for query in build_query_candidates(rec):
        cache_key = normalize_name(query)
        if cache_key in geocode_cache:
            cached = geocode_cache[cache_key]
            if cached:
                return (float(cached[0]), float(cached[1])), "matched_online_nominatim_cache"
            continue

        online = geocode_nominatim(query)
        if online:
            geocode_cache[cache_key] = [online[0], online[1]]
            # Respect Nominatim usage policy by spacing requests.
            time.sleep(1.0)
            return online, "matched_online_nominatim"

        geocode_cache[cache_key] = None
        time.sleep(1.0)

    return (0.0, 0.0), "unresolved"


def main():
    v4 = load_json(V4_PATH)
    schools_final = load_json(SCHOOLS_FINAL_PATH)

    if len(v4) != 191:
        raise ValueError(f"Expected 191 rows in nycu_v4_merged.json, got {len(v4)}")

    coord_index, coord_entries = build_coord_index(schools_final)
    geocode_cache = load_geocode_cache(GEOCODE_CACHE_PATH)

    cleaned = []
    unresolved_geo = []

    for row in v4:
        rec = dict(row)

        for field in ["name", "name_en", "country", "quota_full", "eligibility_full", "language_full", "grade_full", "remarks_full"]:
            rec[field] = clean_text_field(rec.get(field, ""))

        parsed_quota = parse_quota_and_terms(rec.get("quota_full", ""))
        gpa_min, gpa_scale = parse_gpa(rec.get("grade_full", ""))
        parsed_lang = parse_language(rec.get("language_full", ""))

        lat = rec.get("lat", 0) or 0
        lng = rec.get("lng", 0) or 0

        if not lat or not lng:
            (lat, lng), geo_status = resolve_coordinate(rec, coord_index, coord_entries, geocode_cache)
        else:
            lat = float(lat)
            lng = float(lng)
            geo_status = "original"

        rec["lat"] = lat
        rec["lng"] = lng
        rec["geo_status"] = geo_status

        rec["term_fall"] = parsed_quota["term_fall"]
        rec["term_spring"] = parsed_quota["term_spring"]
        rec["quota_fall"] = parsed_quota["quota_fall"]
        rec["quota_spring"] = parsed_quota["quota_spring"]
        rec["quota_unit"] = parsed_quota["quota_unit"]

        rec["gpa_min"] = gpa_min
        rec["gpa_scale"] = gpa_scale
        rec["ibt_min"] = parsed_lang["ibt_min"]
        rec["ielts_min"] = parsed_lang["ielts_min"]
        rec["toeic_min"] = parsed_lang["toeic_min"]
        rec["jlpt_min_level"] = parsed_lang["jlpt_min_level"]

        if rec["lat"] == 0 or rec["lng"] == 0:
            unresolved_geo.append({"id": rec.get("id"), "name": rec.get("name"), "name_en": rec.get("name_en")})

        cleaned.append(rec)

    ids = [r.get("id") for r in cleaned]
    unique_ids = set(ids)

    if len(cleaned) != 191:
        raise ValueError(f"Output rows must be 191, got {len(cleaned)}")
    if len(unique_ids) != 191:
        raise ValueError("ID uniqueness check failed")
    if sorted(unique_ids) != list(range(191)):
        raise ValueError("ID continuity check failed: expected 0..190")

    name_country = [(r.get("name", ""), r.get("country", "")) for r in cleaned]
    dup_name_country = sum(1 for _, c in Counter(name_country).items() if c > 1)

    nonzero_geo = sum(1 for r in cleaned if (r.get("lat", 0) != 0 and r.get("lng", 0) != 0))
    nonzero_geo_rate = (nonzero_geo / len(cleaned)) * 100

    language_empty = sum(1 for r in cleaned if not (r.get("language_full") or "").strip())
    grade_empty = sum(1 for r in cleaned if not (r.get("grade_full") or "").strip())
    gpa_parseable = sum(1 for r in cleaned if r.get("gpa_min") is not None)
    gpa_parseable_rate = (gpa_parseable / len(cleaned)) * 100
    online_count = sum(1 for r in cleaned if str(r.get("geo_status", "")).startswith("matched_online_nominatim"))

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    save_geocode_cache(GEOCODE_CACHE_PATH, geocode_cache)

    lines = []
    lines.append("# NYCU 191 Clean Audit")
    lines.append("")
    lines.append("## Summary")
    lines.append(f"- total_rows: {len(cleaned)}")
    lines.append(f"- unique_ids: {len(unique_ids)}")
    lines.append(f"- duplicate_name_country_pairs: {dup_name_country}")
    lines.append(f"- nonzero_coordinates: {nonzero_geo}/{len(cleaned)} ({nonzero_geo_rate:.2f}%)")
    lines.append(f"- matched_online_nominatim: {online_count}")
    lines.append(f"- language_full_empty: {language_empty}")
    lines.append(f"- grade_full_empty: {grade_empty}")
    lines.append(f"- gpa_min_parseable: {gpa_parseable}/{len(cleaned)} ({gpa_parseable_rate:.2f}%)")
    lines.append("")
    lines.append("## Unresolved Coordinates")
    if not unresolved_geo:
        lines.append("- none")
    else:
        for item in unresolved_geo:
            lines.append(f"- id={item['id']}, name={item['name']}, name_en={item['name_en']}")

    with AUDIT_PATH.open("w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print("Clean completed")
    print(f"Output: {OUTPUT_PATH}")
    print(f"Audit: {AUDIT_PATH}")
    print(f"Rows: {len(cleaned)}")
    print(f"Non-zero coordinates: {nonzero_geo}/{len(cleaned)}")
    print(f"Unresolved coordinates: {len(unresolved_geo)}")


if __name__ == "__main__":
    main()
