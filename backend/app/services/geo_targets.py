from dataclasses import dataclass


@dataclass(frozen=True)
class GeoTarget:
    code: str
    label: str
    google_geo: str
    youtube_region: str
    tiktok_country: str
    accept_language: str
    pytrends_pn: str | None = None
    tiktok_supported: bool = False


_PRESET_TARGETS: dict[str, GeoTarget] = {
    "US": GeoTarget(
        code="US",
        label="United States",
        google_geo="US",
        youtube_region="US",
        tiktok_country="US",
        accept_language="en-US,en;q=0.9",
        pytrends_pn="united_states",
        tiktok_supported=True,
    ),
    "BO": GeoTarget(
        code="BO",
        label="Bolivia",
        google_geo="BO",
        youtube_region="BO",
        tiktok_country="BO",
        accept_language="es-BO,es-419;q=0.9,en;q=0.7",
    ),
    "AR": GeoTarget(
        code="AR",
        label="Argentina",
        google_geo="AR",
        youtube_region="AR",
        tiktok_country="AR",
        accept_language="es-AR,es-419;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "BR": GeoTarget(
        code="BR",
        label="Brazil",
        google_geo="BR",
        youtube_region="BR",
        tiktok_country="BR",
        accept_language="pt-BR,pt;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "CL": GeoTarget(
        code="CL",
        label="Chile",
        google_geo="CL",
        youtube_region="CL",
        tiktok_country="CL",
        accept_language="es-CL,es-419;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "CO": GeoTarget(
        code="CO",
        label="Colombia",
        google_geo="CO",
        youtube_region="CO",
        tiktok_country="CO",
        accept_language="es-CO,es-419;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "EC": GeoTarget(
        code="EC",
        label="Ecuador",
        google_geo="EC",
        youtube_region="EC",
        tiktok_country="EC",
        accept_language="es-EC,es-419;q=0.9,en;q=0.7",
    ),
    "ES": GeoTarget(
        code="ES",
        label="Spain",
        google_geo="ES",
        youtube_region="ES",
        tiktok_country="ES",
        accept_language="es-ES,es;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "MX": GeoTarget(
        code="MX",
        label="Mexico",
        google_geo="MX",
        youtube_region="MX",
        tiktok_country="MX",
        accept_language="es-MX,es-419;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "PE": GeoTarget(
        code="PE",
        label="Peru",
        google_geo="PE",
        youtube_region="PE",
        tiktok_country="PE",
        accept_language="es-PE,es-419;q=0.9,en;q=0.7",
        tiktok_supported=True,
    ),
    "PY": GeoTarget(
        code="PY",
        label="Paraguay",
        google_geo="PY",
        youtube_region="PY",
        tiktok_country="PY",
        accept_language="es-PY,es-419;q=0.9,en;q=0.7",
    ),
    "UY": GeoTarget(
        code="UY",
        label="Uruguay",
        google_geo="UY",
        youtube_region="UY",
        tiktok_country="UY",
        accept_language="es-UY,es-419;q=0.9,en;q=0.7",
    ),
    "VE": GeoTarget(
        code="VE",
        label="Venezuela",
        google_geo="VE",
        youtube_region="VE",
        tiktok_country="VE",
        accept_language="es-VE,es-419;q=0.9,en;q=0.7",
    ),
}


def normalize_geo_code(value: str | None) -> str:
    cleaned = str(value or "").strip().upper()
    return cleaned or "US"


def resolve_geo_target(value: str | None) -> GeoTarget:
    code = normalize_geo_code(value)
    preset = _PRESET_TARGETS.get(code)
    if preset:
        return preset
    return GeoTarget(
        code=code,
        label=code,
        google_geo=code,
        youtube_region=code,
        tiktok_country=code,
        accept_language="en-US,en;q=0.9",
    )


def attach_geo_metadata(metadata: dict | None, geo_code: str | None, *, precise: bool = True) -> dict:
    payload = dict(metadata or {})
    target = resolve_geo_target(geo_code)
    payload["geo_code"] = target.code
    payload["geo_label"] = target.label
    payload["geo_precise"] = precise
    return payload
