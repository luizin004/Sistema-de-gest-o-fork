from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class BusinessHoursConfig:
    tz_name: str = "America/Sao_Paulo"

    weekday_start: time = time(8, 0)
    weekday_end: time = time(18, 0)

    saturday_start: time = time(9, 0)
    saturday_end: time = time(12, 0)


def _as_local(dt: datetime, tz: ZoneInfo) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=tz)
    return dt.astimezone(tz)


def is_within_business_hours(
    now: datetime, cfg: BusinessHoursConfig = BusinessHoursConfig()
) -> bool:
    tz = ZoneInfo(cfg.tz_name)
    local_now = _as_local(now, tz)

    weekday = local_now.weekday()  # 0=Mon..6=Sun
    t = local_now.time()

    if weekday <= 4:
        return cfg.weekday_start <= t < cfg.weekday_end

    if weekday == 5:
        return cfg.saturday_start <= t < cfg.saturday_end

    return False


def next_business_time(
    now: datetime, cfg: BusinessHoursConfig = BusinessHoursConfig()
) -> datetime:
    tz = ZoneInfo(cfg.tz_name)
    local_now = _as_local(now, tz)

    def _window_for_weekday(weekday: int) -> tuple[time, time] | None:
        if weekday <= 4:
            return (cfg.weekday_start, cfg.weekday_end)
        if weekday == 5:
            return (cfg.saturday_start, cfg.saturday_end)
        return None

    for add_days in range(0, 8):
        candidate_dt = local_now + timedelta(days=add_days)
        window = _window_for_weekday(candidate_dt.weekday())
        if window is None:
            continue

        start_t, end_t = window
        if add_days == 0:
            t = local_now.time()
            if t < start_t:
                return local_now.replace(
                    hour=start_t.hour,
                    minute=start_t.minute,
                    second=0,
                    microsecond=0,
                )
            if t >= end_t:
                continue
            return local_now

        return datetime.combine(candidate_dt.date(), start_t, tzinfo=tz)

    return local_now


def seconds_until_next_business_time(
    now: datetime, cfg: BusinessHoursConfig = BusinessHoursConfig()
) -> int:
    tz = ZoneInfo(cfg.tz_name)
    local_now = _as_local(now, tz)
    target = next_business_time(local_now, cfg)

    delta = target - local_now
    seconds = int(delta.total_seconds())
    return max(0, seconds)
