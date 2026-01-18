// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WaterRules
 * @notice Pure library for deterministic water consumption rule evaluation
 * @dev No storage, no state, no events. All functions are pure.
 * 
 * Used by protocol contracts to evaluate:
 * - Consumption anomalies (significant drops)
 * - Measurement discrepancies (reported vs actual)
 * - Tolerance thresholds
 */
library WaterRules {

    /// @notice Basis points constant (100% = 10000 bps)
    uint256 internal constant BPS_BASE = 10000;
    
    /// @notice Anomaly threshold: 50% drop = 5000 bps
    uint256 internal constant ANOMALY_THRESHOLD_BPS = 5000;

    /**
     * @notice Calculate consumption drop percentage in basis points
     * @param current Current period consumption
     * @param average Historical average consumption
     * @return Drop percentage in basis points (0-10000+)
     * @dev Returns 0 if average is 0 (cannot calculate meaningful drop)
     * @dev Returns 0 if current >= average (no drop)
     * @dev Safe from division by zero
     */
    function calculateDropPercent(
        uint256 current,
        uint256 average
    ) internal pure returns (uint256) {
        // No average data - cannot calculate meaningful drop
        if (average == 0) {
            return 0;
        }
        
        // No drop if current >= average
        if (current >= average) {
            return 0;
        }
        
        // Calculate drop: ((average - current) * 10000) / average
        uint256 drop = average - current;
        return (drop * BPS_BASE) / average;
    }

    /**
     * @notice Check if consumption drop indicates an anomaly
     * @param dropPercentBps Drop percentage in basis points
     * @return True if drop >= 50% (5000 bps)
     */
    function isAnomalyDetected(
        uint256 dropPercentBps
    ) internal pure returns (bool) {
        return dropPercentBps >= ANOMALY_THRESHOLD_BPS;
    }

    /**
     * @notice Calculate absolute difference between reported and actual readings
     * @param reported Value reported by user
     * @param actual Value measured by inspector
     * @return Absolute difference
     */
    function calculateMeasurementDelta(
        uint256 reported,
        uint256 actual
    ) internal pure returns (uint256) {
        if (reported >= actual) {
            return reported - actual;
        }
        return actual - reported;
    }

    /**
     * @notice Check if measurement delta is within acceptable tolerance
     * @param delta Absolute difference between values
     * @param toleranceBps Tolerance percentage in basis points (e.g., 500 = 5%)
     * @param referenceValue Reference value to calculate tolerance against
     * @return True if delta <= (referenceValue * toleranceBps / 10000)
     */
    function isWithinTolerance(
        uint256 delta,
        uint256 toleranceBps,
        uint256 referenceValue
    ) internal pure returns (bool) {
        // Calculate allowed tolerance as percentage of reference
        uint256 allowedDelta = (referenceValue * toleranceBps) / BPS_BASE;
        return delta <= allowedDelta;
    }

    /**
     * @notice Combined check: is measurement within tolerance?
     * @param reported Reported value
     * @param actual Actual measured value
     * @param toleranceBps Tolerance in basis points
     * @return withinTolerance True if within tolerance
     * @return delta The absolute difference
     * @dev Uses max(reported, actual) as reference to prevent gaming via small values.
     *      This is a helper function. Protocol must decide consequences.
     *      This function does not imply validity or fraud.
     */
    function evaluateMeasurement(
        uint256 reported,
        uint256 actual,
        uint256 toleranceBps
    ) internal pure returns (bool withinTolerance, uint256 delta) {
        delta = calculateMeasurementDelta(reported, actual);
        
        // Use larger value as reference for tolerance calculation.
        // Rationale: Using the smaller value would allow users to game the system
        // by underreporting, making the tolerance window smaller than intended.
        uint256 referenceValue = reported > actual ? reported : actual;
        
        withinTolerance = isWithinTolerance(delta, toleranceBps, referenceValue);
    }

    /**
     * @notice Calculate underpayment amount based on reading discrepancy
     * @param reported Reported reading
     * @param actual Actual reading
     * @param unitPrice Price per unit of consumption
     * @return Underpayment amount (0 if no underpayment)
     * @dev Underpayment occurs when actual > reported (user underreported)
     */
    function calculateUnderpayment(
        uint256 reported,
        uint256 actual,
        uint256 unitPrice
    ) internal pure returns (uint256) {
        if (actual <= reported) {
            return 0;
        }
        
        uint256 underreported = actual - reported;
        return underreported * unitPrice;
    }

    /**
     * @notice Check if a reading sequence is valid (non-decreasing)
     * @param previousReading Previous meter reading
     * @param currentReading Current meter reading
     * @return True if current >= previous
     */
    function isValidReadingSequence(
        uint256 previousReading,
        uint256 currentReading
    ) internal pure returns (bool) {
        return currentReading >= previousReading;
    }

    /**
     * @notice Calculate consumption from two readings
     * @param previousReading Previous meter reading
     * @param currentReading Current meter reading
     * @return Consumption (0 if invalid sequence)
     * @dev Invalid sequences (current < previous) return 0 as soft-fail.
     *      This is intentional: protocol should route such cases to inspection
     *      rather than reverting. Caller must handle zero-consumption cases.
     */
    function calculateConsumption(
        uint256 previousReading,
        uint256 currentReading
    ) internal pure returns (uint256) {
        if (currentReading < previousReading) {
            return 0;
        }
        return currentReading - previousReading;
    }

    /**
     * @notice Evaluate if consumption change warrants inspection
     * @param current Current consumption
     * @param average Historical average
     * @return requiresInspection True if anomaly detected
     * @return dropBps The drop percentage in basis points
     */
    function evaluateConsumptionChange(
        uint256 current,
        uint256 average
    ) internal pure returns (bool requiresInspection, uint256 dropBps) {
        dropBps = calculateDropPercent(current, average);
        requiresInspection = isAnomalyDetected(dropBps);
    }
}
