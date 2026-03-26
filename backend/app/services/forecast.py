from datetime import UTC, datetime, timedelta
from typing import Any


def _linear_forecast(values: list[tuple[datetime, float]], horizon_hours: int = 6) -> list[dict[str, Any]]:
    if not values:
        now = datetime.now(UTC)
        return [{"ts": now + timedelta(hours=i + 1), "momentum": 0.0} for i in range(horizon_hours)]

    points = sorted(values, key=lambda x: x[0])
    if len(points) < 2:
        slope = 0.0
    else:
        delta_v = points[-1][1] - points[0][1]
        delta_h = max((points[-1][0] - points[0][0]).total_seconds() / 3600, 1e-6)
        slope = delta_v / delta_h

    last_ts, last_val = points[-1]
    return [{"ts": last_ts + timedelta(hours=i), "momentum": max(last_val + slope * i, 0.0)} for i in range(1, horizon_hours + 1)]


def generate_forecast(values: list[tuple[datetime, float]], horizon_hours: int = 6) -> tuple[list[dict[str, Any]], float]:
    try:
        import pandas as pd
        from prophet import Prophet

        if len(values) < 3:
            linear = _linear_forecast(values, horizon_hours)
            return linear, 0.45

        df = pd.DataFrame({"ds": [d for d, _ in values], "y": [v for _, v in values]})
        model = Prophet(daily_seasonality=False, weekly_seasonality=False)
        model.fit(df)
        future = model.make_future_dataframe(periods=horizon_hours, freq="h")
        prediction = model.predict(future).tail(horizon_hours)
        points = [{"ts": row.ds.to_pydatetime(), "momentum": max(float(row.yhat), 0.0)} for row in prediction.itertuples()]
        return points, 0.72
    except Exception:  # noqa: BLE001
        linear = _linear_forecast(values, horizon_hours)
        return linear, 0.52

