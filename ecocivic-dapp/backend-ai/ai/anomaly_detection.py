from database.db import get_db
from database.models import WaterMeterReading
from sqlalchemy import desc

def check_anomaly(current_index: int, historical_indexes: list[int]) -> bool:
    """
    %40 üzeri sapma varsa False döner
    """
    if not historical_indexes or current_index is None:
        # Geçmiş veri yoksa, ilk okuma kabul edilir (veya politika gereği manuel onaya düşebilir)
        return True

    avg = sum(historical_indexes) / len(historical_indexes)

    # Sıfıra bölme hatası önlemi
    if avg == 0:
        return True

    deviation = abs(current_index - avg) / avg

    if deviation > 0.40:
        return False

    return True


def get_historical_data(meter_no: str, limit: int = 3) -> list[int]:
    """
    Belirtilen sayaç numarasının son okuma endekslerini getirir.
    """
    try:
        with get_db() as db:
            readings = db.query(WaterMeterReading.reading_index)\
                .filter(WaterMeterReading.meter_no == meter_no)\
                .order_by(desc(WaterMeterReading.created_at))\
                .limit(limit)\
                .all()
            
            # readings -> [(120,), (110,), ...] formatında gelir
            return [r[0] for r in readings]
    except Exception as e:
        # Log error in production
        print(f"Error fetching historical data: {e}")
        return []

# Backwards compatibility alias if needed, or update consumers
get_mock_historical_data = get_historical_data
