import json
import logging
from typing import Any

import requests

from app.core.config import get_settings
from app.models.trend import Trend
from app.schemas.prompt import PromptGeneratorConfigIn

logger = logging.getLogger(__name__)
settings = get_settings()


def _resolve_generator_config(generator_config: PromptGeneratorConfigIn | None) -> tuple[str | None, str]:
    override_key = str(generator_config.api_key or "").strip() if generator_config else ""
    override_model = str(generator_config.model or "").strip() if generator_config else ""
    api_key = override_key or settings.gemini_api_key
    model = override_model or settings.gemini_model
    return api_key, model


def _extract_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            stripped = "\n".join(lines[1:-1]).strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("forecast_explanation_no_json_object")
    return json.loads(stripped[start : end + 1])


def _to_float(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).strip())
    except Exception:  # noqa: BLE001
        return 0.0


def _local_forecast_explanation(
    trend: Trend,
    snapshots: list[dict[str, Any]],
    forecast_points: list[dict[str, Any]],
    confidence: float,
    language: str = "en",
) -> dict[str, Any]:
    current_views = _to_float(snapshots[-1]["metric_views"]) if snapshots else (_to_float(forecast_points[0]["momentum"]) if forecast_points else 0.0)
    forecast_end = _to_float(forecast_points[-1]["momentum"]) if forecast_points else current_views
    projected_peak = max((_to_float(point["momentum"]) for point in forecast_points), default=current_views)
    peak_index = next(
        (index for index, point in enumerate(forecast_points, start=1) if _to_float(point["momentum"]) >= projected_peak),
        None,
    )
    projected_growth = ((forecast_end - current_views) / current_views) if current_views > 0 else 0.0
    forecast_hours = max(len(forecast_points), 1)
    hourly_growth = max((forecast_end - current_views) / forecast_hours, 0.0)
    viral_target = current_views * 1.45 if current_views > 0 else projected_peak * 1.2
    hours_to_target = ((viral_target - current_views) / hourly_growth) if hourly_growth > 0 and viral_target > current_views else None
    days_to_target = round(hours_to_target / 24, 1) if hours_to_target is not None else None

    is_spanish = language.lower().startswith("es")
    if projected_growth >= 0.2:
        outlook = "alcista" if is_spanish else "rising"
        title = "El momentum todavía apunta al alza" if is_spanish else "Momentum points to additional upside"
    elif projected_growth <= -0.08:
        outlook = "enfriandose" if is_spanish else "cooling"
        title = "La tendencia parece más cerca de enfriarse que de explotar" if is_spanish else "The trend looks closer to cooling than exploding"
    else:
        outlook = "estable" if is_spanish else "stable"
        title = "La tendencia se mueve, pero todavía no muestra ruptura clara" if is_spanish else "The trend is moving, but without a breakout signal yet"

    could_go_viral = bool(hours_to_target is not None and hours_to_target <= 72 and confidence >= 0.45)
    if is_spanish:
        if could_go_viral and days_to_target is not None:
            summary = (
                f"{trend.title} todavía tiene potencial de despegar. Si el ritmo proyectado se mantiene, podría entrar en una ventana más viral en alrededor de "
                f"{days_to_target} día(s), aunque la curva visible solo está proyectando las próximas {forecast_hours} horas."
            )
        elif outlook == "alcista":
            summary = (
                f"{trend.title} sigue creciendo, pero la señal actual apunta más a una subida gradual que a una explosión inmediata. "
                f"Si el ritmo por hora mejora, la ventana viral llegaría más adelante y no necesariamente hoy."
            )
        elif outlook == "enfriandose":
            summary = (
                f"{trend.title} tiene más probabilidad de aplanarse o enfriarse que de hacerse mucho más grande en el corto plazo. "
                f"Ahora mismo el modelo no ve una aceleración viral fuerte."
            )
        else:
            summary = (
                f"{trend.title} está en una zona mixta. El pronóstico no anticipa una caída fuerte, pero tampoco muestra todavía suficiente aceleración "
                f"como para afirmar que el breakout es inminente."
            )
        based_on = [
            f"Base actual: alrededor de {current_views:,.0f} vistas frente a una proyección de {forecast_end:,.0f} al final de la ventana.",
            f"Cambio proyectado para las próximas {forecast_hours} horas: {projected_growth * 100:.1f}% con una confianza de {confidence * 100:.0f}%.",
            (
                f"El pico más alto visible dentro de la proyección aparece cerca de la hora {peak_index}."
                if peak_index
                else "La ventana visible todavía no muestra un pico claro."
            ),
        ]
        methodology = (
            "Esta explicación se basa en snapshots recientes guardados, la velocidad actual y la curva de forecast generada a partir de la serie temporal más reciente. "
            "La estimación en días extrapola el ritmo por hora proyectado y sirve como orientación, no como garantía."
        )
    else:
        if could_go_viral and days_to_target is not None:
            summary = (
                f"{trend.title} still has breakout potential. At the current projected pace, it could push into a stronger viral window in about "
                f"{days_to_target} day(s), although the near-term chart is only projecting the next {forecast_hours} hours."
            )
        elif outlook == "rising":
            summary = (
                f"{trend.title} is still climbing, but the current signal suggests gradual growth more than an immediate explosion. "
                f"If that hourly pace improves, the viral window would arrive later rather than today."
            )
        elif outlook == "cooling":
            summary = (
                f"{trend.title} is more likely to flatten or cool off than to become much larger soon. "
                f"Right now the model does not support a strong viral acceleration case."
            )
        else:
            summary = (
                f"{trend.title} is in a mixed zone. The forecast is not calling a collapse, but it also does not yet show enough acceleration "
                f"to say a breakout is imminent."
            )
        based_on = [
            f"Current baseline: about {current_views:,.0f} views against a projected {forecast_end:,.0f} at the end of the forecast window.",
            f"Projected change across the next {forecast_hours} hours: {projected_growth * 100:.1f}% with confidence at {confidence * 100:.0f}%.",
            (
                f"Potential peak inside the visible forecast appears around hour {peak_index}."
                if peak_index
                else "The visible forecast window does not show a clear peak yet."
            ),
        ]
        methodology = (
            "This explanation is based on recent stored snapshots, current velocity, and the forecast curve generated from the latest time-series data. "
            "The day estimate extrapolates the projected hourly pace and is directional, not a guarantee."
        )

    return {
        "title": title,
        "summary": summary,
        "outlook": outlook,
        "could_go_viral": could_go_viral,
        "virality_window_hours": round(hours_to_target, 1) if hours_to_target is not None else None,
        "virality_window_days": days_to_target,
        "based_on": based_on,
        "methodology": methodology,
        "generated_with": "local",
    }


def explain_forecast(
    trend: Trend,
    snapshots: list[dict[str, Any]],
    forecast_points: list[dict[str, Any]],
    confidence: float,
    language: str = "en",
    generator_config: PromptGeneratorConfigIn | None = None,
) -> dict[str, Any]:
    fallback = _local_forecast_explanation(trend, snapshots, forecast_points, confidence, language=language)
    api_key, model = _resolve_generator_config(generator_config)
    if not api_key:
        return fallback

    current_views = _to_float(snapshots[-1]["metric_views"]) if snapshots else 0.0
    forecast_end = _to_float(forecast_points[-1]["momentum"]) if forecast_points else current_views
    response_language = "Spanish" if language.lower().startswith("es") else "English"
    prompt = (
        "Return ONLY valid JSON with keys: title, summary, outlook, could_go_viral, virality_window_hours, virality_window_days, based_on, methodology. "
        "based_on must be an array with 3 short explanatory strings. No markdown.\n"
        f"Write the response in {response_language}.\n"
        f"Trend title: {trend.title}\n"
        f"Platform: {trend.platform}\n"
        f"Category: {trend.category}\n"
        f"Velocity score: {trend.velocity_score}\n"
        f"Rank score: {trend.rank_score}\n"
        f"Historical snapshots: {json.dumps(snapshots[-12:], default=str)}\n"
        f"Forecast points: {json.dumps(forecast_points, default=str)}\n"
        f"Current baseline views: {current_views}\n"
        f"Forecast end views: {forecast_end}\n"
        f"Confidence: {confidence}\n"
        "Explain clearly for a non-technical user what the line means, whether it looks likely to go viral, roughly how many days it could take if the current pace holds, "
        "and what the estimate is based on. Be concrete, realistic, and never guarantee virality."
    )

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    try:
        response = requests.post(
            endpoint,
            params={"key": api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "topP": 0.8, "candidateCount": 1},
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        candidates = payload.get("candidates") or []
        if not candidates:
            raise RuntimeError("forecast_explanation_empty_candidates")
        parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
        text = "\n".join(str(part.get("text", "")) for part in parts if isinstance(part, dict)).strip()
        parsed = _extract_json_object(text)
        explanation = {
            "title": str(parsed.get("title") or fallback["title"]).strip() or fallback["title"],
            "summary": str(parsed.get("summary") or fallback["summary"]).strip() or fallback["summary"],
            "outlook": str(parsed.get("outlook") or fallback["outlook"]).strip() or fallback["outlook"],
            "could_go_viral": bool(parsed.get("could_go_viral")),
            "virality_window_hours": round(_to_float(parsed.get("virality_window_hours")), 1) if parsed.get("virality_window_hours") is not None else None,
            "virality_window_days": round(_to_float(parsed.get("virality_window_days")), 1) if parsed.get("virality_window_days") is not None else None,
            "based_on": [str(item).strip() for item in parsed.get("based_on", []) if str(item).strip()] or fallback["based_on"],
            "methodology": str(parsed.get("methodology") or fallback["methodology"]).strip() or fallback["methodology"],
            "generated_with": "gemini",
        }
        if len(explanation["based_on"]) < 3:
            explanation["based_on"] = fallback["based_on"]
        return explanation
    except Exception as exc:  # noqa: BLE001
        logger.warning("forecast_explanation_gemini_failed_fallback_local error=%s", exc)
        return fallback
