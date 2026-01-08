def check_anomaly(current_index: int, historical_indexes: list[int]) -> bool:
    """
    %40 üzeri sapma varsa False döner
    """
    if not historical_indexes or current_index is None:
        return False

    avg = sum(historical_indexes) / len(historical_indexes)

    deviation = abs(current_index - avg) / avg

    if deviation > 0.40:
        return False

    return True


def get_mock_historical_data(meter_no: str) -> list[int]:
    """
    Mock geçmiş 3 ay verisi
    Gerçek projede DB'den gelecek
    """
    return [120, 130, 125]
