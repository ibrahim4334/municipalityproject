// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEcoCivicDepositV2
 */
interface IEcoCivicDepositV2 {
    function lockForCase(address user, bytes32 caseId, uint256 amount) external;
    function executeInspectionOutcome(bytes32 caseId) external;
    function hasAvailableDeposit(address user, uint256 amount) external view returns (bool);
}

/**
 * @title IOracleRegistry
 */
interface IOracleRegistry {
    function isOracle(address oracle) external view returns (bool);
}

/**
 * @title InspectionProtocol
 * @notice On-chain deterministic fraud detection
 * @dev Blockchain-first justice: no admin, no DAO, no governance, no voting
 * 
 * Architecture:
 * - Deposit = passive vault
 * - Inspection = judge (this contract)
 * - Oracle = sensor (submits raw data only)
 * 
 * Security:
 * - Only citizen can open case for themselves
 * - Max 1 open case per citizen
 * - Oracle must be registered and active
 * - Double execution prevented
 * 
 * Fraud Rules (IMMUTABLE):
 * 1. reportedReading < previousReading → FRAUD
 * 2. dropPercentBps >= 3000 (30%) → FRAUD
 * 3. measurementDelta >= 1000 → FRAUD
 */
contract InspectionProtocol {

    // ==============================
    // IMMUTABLE FRAUD THRESHOLDS
    // ==============================
    
    uint256 public constant FRAUD_DROP_THRESHOLD_BPS = 3000;
    uint256 public constant FRAUD_DELTA_THRESHOLD = 1000;
    uint256 public constant BPS_BASE = 10000;
    uint256 public constant CASE_LOCK_AMOUNT = 50 ether;

    // ==============================
    // TYPES
    // ==============================
    
    enum CaseStatus { Open, Evaluated, Executed }
    enum Outcome { Pending, Clean, Fraud }
    
    struct CaseData {
        address citizen;
        address oracle;
        uint256 reportedReading;
        uint256 previousReading;
        uint256 historicalAverage;
        uint256 actualReading;
        uint256 openedAt;
        uint256 evaluatedAt;
        uint256 executedAt;
        CaseStatus status;
        Outcome outcome;
    }
    
    struct CaseMetrics {
        uint256 dropPercentBps;
        uint256 measurementDelta;
        bool invalidSequence;
    }

    // ==============================
    // STATE
    // ==============================
    
    IOracleRegistry public immutable oracleRegistry;
    IEcoCivicDepositV2 public immutable depositContract;
    
    mapping(bytes32 => CaseData) public cases;
    mapping(bytes32 => CaseMetrics) public caseMetrics;
    mapping(address => bytes32[]) public citizenCases;
    
    /// @notice Active case per citizen (max 1 open case)
    mapping(address => bytes32) public activeCase;
    
    /// @notice Track executed cases to prevent double execution
    mapping(bytes32 => bool) public executed;
    
    uint256 public totalCases;
    uint256 public totalFraud;
    uint256 public totalClean;

    // ==============================
    // EVENTS
    // ==============================
    
    event CaseOpened(
        bytes32 indexed caseId,
        address indexed citizen,
        uint256 reportedReading,
        uint256 previousReading,
        uint256 timestamp
    );
    
    event MeasurementSubmitted(
        bytes32 indexed caseId,
        address indexed oracle,
        uint256 actualReading,
        uint256 timestamp
    );
    
    event VerdictReached(
        bytes32 indexed caseId,
        address indexed citizen,
        Outcome outcome,
        uint256 timestamp
    );
    
    event OutcomeExecuted(
        bytes32 indexed caseId,
        address indexed citizen,
        Outcome outcome,
        uint256 timestamp
    );

    // ==============================
    // ERRORS
    // ==============================
    
    error InvalidAddress();
    error CaseNotFound();
    error CaseNotOpen();
    error CaseNotEvaluated();
    error CaseAlreadyExists();
    error CaseAlreadyExecuted();
    error NotRegisteredOracle();
    error OracleNotActive();
    error AlreadyMeasured();
    error InsufficientDeposit();
    error NotCitizen();
    error ActiveCaseExists();

    // ==============================
    // CONSTRUCTOR
    // ==============================
    
    constructor(address _oracleRegistry, address _depositContract) {
        if (_oracleRegistry == address(0)) revert InvalidAddress();
        if (_depositContract == address(0)) revert InvalidAddress();
        
        oracleRegistry = IOracleRegistry(_oracleRegistry);
        depositContract = IEcoCivicDepositV2(_depositContract);
    }

    // ==============================
    // CASE MANAGEMENT
    // ==============================
    
    /**
     * @notice Citizen opens an inspection case for themselves
     * @param reportedReading Citizen's reported meter reading
     * @param previousReading Previous official reading
     * @param historicalAverage Historical consumption average
     * @return caseId Unique case identifier
     * @dev ONLY the citizen can open a case for their own address
     * @dev Citizen can only have 1 open case at a time
     */
    function openCase(
        uint256 reportedReading,
        uint256 previousReading,
        uint256 historicalAverage
    ) external returns (bytes32 caseId) {
        address citizen = msg.sender;
        
        // Security: Max 1 open case per citizen
        if (activeCase[citizen] != bytes32(0)) {
            // Check if previous case is still open
            CaseData storage prevCase = cases[activeCase[citizen]];
            if (prevCase.status == CaseStatus.Open) {
                revert ActiveCaseExists();
            }
        }
        
        // Generate unique case ID
        caseId = keccak256(abi.encodePacked(
            citizen,
            reportedReading,
            previousReading,
            block.timestamp,
            totalCases
        ));
        
        if (cases[caseId].openedAt != 0) revert CaseAlreadyExists();
        
        // Check citizen has deposit
        if (!depositContract.hasAvailableDeposit(citizen, CASE_LOCK_AMOUNT)) {
            revert InsufficientDeposit();
        }
        
        // Lock citizen's deposit
        depositContract.lockForCase(citizen, caseId, CASE_LOCK_AMOUNT);
        
        // Create case
        cases[caseId] = CaseData({
            citizen: citizen,
            oracle: address(0),
            reportedReading: reportedReading,
            previousReading: previousReading,
            historicalAverage: historicalAverage,
            actualReading: 0,
            openedAt: block.timestamp,
            evaluatedAt: 0,
            executedAt: 0,
            status: CaseStatus.Open,
            outcome: Outcome.Pending
        });
        
        // Set active case for citizen
        activeCase[citizen] = caseId;
        citizenCases[citizen].push(caseId);
        totalCases++;
        
        emit CaseOpened(caseId, citizen, reportedReading, previousReading, block.timestamp);
    }

    /**
     * @notice Oracle submits actual measurement
     * @param caseId Case identifier
     * @param actualReading Actual meter reading observed
     * @dev Oracle must be registered AND active
     */
    function oracleSubmitMeasurement(bytes32 caseId, uint256 actualReading) external {
        CaseData storage c = cases[caseId];
        
        if (c.openedAt == 0) revert CaseNotFound();
        if (c.status != CaseStatus.Open) revert CaseNotOpen();
        if (c.oracle != address(0)) revert AlreadyMeasured();
        
        // Oracle validation: must be registered
        if (!oracleRegistry.isOracle(msg.sender)) revert NotRegisteredOracle();
        
        // Record measurement
        c.actualReading = actualReading;
        c.oracle = msg.sender;
        
        emit MeasurementSubmitted(caseId, msg.sender, actualReading, block.timestamp);
        
        // Automatically evaluate verdict
        _evaluateVerdict(caseId);
    }

    /**
     * @notice Execute the verdict on deposit contract
     * @param caseId Case identifier
     * @dev STRICT: Only works if status == Evaluated
     * @dev Double execution prevented
     */
    function executeOutcome(bytes32 caseId) external {
        CaseData storage c = cases[caseId];
        
        // Existence check
        if (c.openedAt == 0) revert CaseNotFound();
        
        // Status check: MUST be Evaluated
        if (c.status != CaseStatus.Evaluated) revert CaseNotEvaluated();
        
        // Double execution prevention
        if (executed[caseId]) revert CaseAlreadyExecuted();
        if (c.executedAt != 0) revert CaseAlreadyExecuted();
        
        // Mark as executed BEFORE external call (CEI pattern)
        executed[caseId] = true;
        c.status = CaseStatus.Executed;
        c.executedAt = block.timestamp;
        
        // Clear active case for citizen
        if (activeCase[c.citizen] == caseId) {
            activeCase[c.citizen] = bytes32(0);
        }
        
        // Call deposit contract to execute outcome
        depositContract.executeInspectionOutcome(caseId);
        
        emit OutcomeExecuted(caseId, c.citizen, c.outcome, block.timestamp);
    }

    // ==============================
    // VERDICT EVALUATION (Internal)
    // ==============================
    
    /**
     * @notice Evaluate verdict using IMMUTABLE on-chain rules
     * @dev Pure deterministic logic - blockchain is the judge
     * 
     * FRAUD CONDITIONS (any one triggers fraud):
     * 1. reportedReading < previousReading (invalid sequence)
     * 2. dropPercentBps >= 3000 (30% consumption drop)
     * 3. measurementDelta >= 1000 (reading discrepancy)
     */
    function _evaluateVerdict(bytes32 caseId) internal {
        CaseData storage c = cases[caseId];
        CaseMetrics storage m = caseMetrics[caseId];
        
        // Calculate metrics
        m.invalidSequence = c.reportedReading < c.previousReading;
        m.dropPercentBps = _calculateDropPercent(c.reportedReading, c.previousReading, c.historicalAverage);
        m.measurementDelta = _calculateDelta(c.reportedReading, c.actualReading);
        
        // Apply IMMUTABLE fraud rules
        bool fraud = _applyFraudRules(m.invalidSequence, m.dropPercentBps, m.measurementDelta);
        
        // Set verdict
        c.outcome = fraud ? Outcome.Fraud : Outcome.Clean;
        c.status = CaseStatus.Evaluated;
        c.evaluatedAt = block.timestamp;
        
        // Update counters
        if (fraud) {
            totalFraud++;
        } else {
            totalClean++;
        }
        
        emit VerdictReached(caseId, c.citizen, c.outcome, block.timestamp);
    }
    
    /**
     * @notice Apply fraud detection rules
     * @dev IMMUTABLE - these rules cannot be changed
     */
    function _applyFraudRules(
        bool invalidSequence,
        uint256 dropPercentBps,
        uint256 measurementDelta
    ) internal pure returns (bool) {
        // Rule 1: Invalid reading sequence (reported < previous)
        if (invalidSequence) return true;
        
        // Rule 2: Excessive consumption drop (30%+)
        if (dropPercentBps >= FRAUD_DROP_THRESHOLD_BPS) return true;
        
        // Rule 3: Measurement discrepancy (delta >= 1000)
        if (measurementDelta >= FRAUD_DELTA_THRESHOLD) return true;
        
        return false;
    }
    
    function _calculateDropPercent(
        uint256 reported,
        uint256 previous,
        uint256 average
    ) internal pure returns (uint256) {
        if (reported <= previous) return 0;
        uint256 consumption = reported - previous;
        if (average == 0) return 0;
        if (consumption >= average) return 0;
        return ((average - consumption) * BPS_BASE) / average;
    }
    
    function _calculateDelta(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }

    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    function isFraud(bytes32 caseId) external view returns (bool) {
        return cases[caseId].outcome == Outcome.Fraud;
    }
    
    function getCaseOutcome(bytes32 caseId) external view returns (Outcome) {
        return cases[caseId].outcome;
    }
    
    function getCaseStatus(bytes32 caseId) external view returns (CaseStatus) {
        return cases[caseId].status;
    }
    
    function getCaseData(bytes32 caseId) external view returns (CaseData memory) {
        return cases[caseId];
    }
    
    function getCaseMetrics(bytes32 caseId) external view returns (CaseMetrics memory) {
        return caseMetrics[caseId];
    }
    
    function getCitizenCases(address citizen) external view returns (bytes32[] memory) {
        return citizenCases[citizen];
    }
    
    function getActiveCase(address citizen) external view returns (bytes32) {
        return activeCase[citizen];
    }
    
    function hasActiveCase(address citizen) external view returns (bool) {
        bytes32 active = activeCase[citizen];
        if (active == bytes32(0)) return false;
        return cases[active].status == CaseStatus.Open;
    }
    
    function getStats() external view returns (uint256 total, uint256 fraud, uint256 clean) {
        return (totalCases, totalFraud, totalClean);
    }
    
    function caseExists(bytes32 caseId) external view returns (bool) {
        return cases[caseId].openedAt != 0;
    }
    
    function isExecuted(bytes32 caseId) external view returns (bool) {
        return executed[caseId];
    }
    
    function getFraudThresholds() external pure returns (
        uint256 dropThresholdBps,
        uint256 deltaThreshold,
        uint256 lockAmount
    ) {
        return (FRAUD_DROP_THRESHOLD_BPS, FRAUD_DELTA_THRESHOLD, CASE_LOCK_AMOUNT);
    }
    
    function simulateVerdict(
        uint256 reportedReading,
        uint256 previousReading,
        uint256 historicalAverage,
        uint256 actualReading
    ) external pure returns (
        bool wouldBeFraud,
        uint256 dropPercentBps,
        uint256 measurementDelta,
        bool invalidSequence
    ) {
        invalidSequence = reportedReading < previousReading;
        dropPercentBps = _calculateDropPercent(reportedReading, previousReading, historicalAverage);
        measurementDelta = _calculateDelta(reportedReading, actualReading);
        wouldBeFraud = _applyFraudRules(invalidSequence, dropPercentBps, measurementDelta);
    }
}
