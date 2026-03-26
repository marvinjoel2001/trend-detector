from datetime import datetime, timezone


def compute_velocity(current_views: int, previous_views: int | None, previous_ts: datetime | None) -> float:
    if previous_views is None or previous_ts is None:
        return 0.0

    elapsed_hours = max((datetime.now(timezone.utc) - previous_ts).total_seconds() / 3600.0, 1 / 3600.0)
    return (current_views - previous_views) / elapsed_hours

