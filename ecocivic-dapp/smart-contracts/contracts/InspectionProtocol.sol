// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/WaterRules.sol";

/**
 * @title InspectionProtocol
 * @notice Decentralized water meter inspection protocol with rule-based outcomes
 * @dev No owner, no admin, no privileged roles. All decisions are deterministic.
 * 
 * This contract:
 * ✅ Opens inspection cases
 * ✅ Accepts oracle attestations (hash references)
 * ✅ Evaluates outcomes using WaterRules library
 * ✅ Classifies outcomes: CLEAN, WARNING, FRAUD
 * ✅ Emits outcome events
 * 
 * This contract does NOT:
 * ❌ Transfer tokens
 * ❌ Execute slashing
 * ❌ Have admin overrides
 * ❌ Make subjective decisions
 * 
 * Slashing is triggered by consuming contracts reading outcomes.
 */
contract InspectionProtocol {
    using WaterRules for *;

    // ==============================
    // CONSTANTS
    // ==============================
    
    /// @notice Tolerance for measurement discrepancy (5% = 500 bps)
    uint256 public constant TOLERANCE_BPS = 500;
    
    /// @notice Time window for oracle to submit attestation
    uint256 public constant ATTESTATION_WINDOW = 14 days;
    
    /// @notice Time after which case auto-resolves if no attestation
    uint256 public constant AUTO_RESOLVE_WINDOW = 21 days;

    // ==============================
    // TYPES
    // ==============================
    
    enum CaseStatus {
        Open,           // Awaiting oracle attestation
        Evaluated,      // Oracle attested, outcome determined
        Expired,        // No attestation within window
        Closed          // Finalized
    }
    
    enum Outcome {
        Pending,        // Not yet evaluated
        Clean,          // No issues found
        Warning,        // Anomaly detected but within tolerance
        Fraud           // Measurement discrepancy exceeds tolerance
    }
    
    struct InspectionCase {
        bytes32 caseId;
        address citizen;
        uint256 reportedReading;
        uint256 previousReading;
        uint256 historicalAverage;
        uint256 actualReading;      // Set by oracle attestation
        bytes32 attestationHash;    // Oracle's data hash
        address attestingOracle;
        uint256 openedAt;
        uint256 evaluatedAt;
        CaseStatus status;
        Outcome outcome;
        uint256 dropPercentBps;     // Consumption drop %
        uint256 measurementDelta;   // Difference between reported & actual
    }

    // ==============================
    // STATE
    // ==============================
    
    /// @notice All inspection cases
    mapping(bytes32 => InspectionCase) public cases;
    
    /// @notice Citizen's active cases
    mapping(address => bytes32[]) public citizenCases;
    
    /// @notice Oracle registry reference (for validation)
    address public immutable oracleRegistry;
    
    /// @notice Total cases opened
    uint256 public totalCases;
    
    /// @notice Cases by outcome count
    mapping(Outcome => uint256) public outcomeCount;

    // ==============================
    // EVENTS
    // ==============================
    
    event CaseOpened(
        bytes32 indexed caseId,
        address indexed citizen,
        uint256 reportedReading,
        uint256 previousReading,
        uint256 historicalAverage,
        uint256 timestamp
    );
    
    event AttestationReceived(
        bytes32 indexed caseId,
        address indexed oracle,
        bytes32 attestationHash,
        uint256 actualReading,
        uint256 timestamp
    );
    
    event CaseEvaluated(
        bytes32 indexed caseId,
        address indexed citizen,
        Outcome outcome,
        uint256 dropPercentBps,
        uint256 measurementDelta,
        bool withinTolerance,
        uint256 timestamp
    );
    
    event CaseExpired(
        bytes32 indexed caseId,
        address indexed citizen,
        uint256 timestamp
    );
    
    event CaseClosed(
        bytes32 indexed caseId,
        Outcome finalOutcome,
        uint256 timestamp
    );

    // ==============================
    // ERRORS
    // ==============================
    
    error CaseNotFound();
    error CaseNotOpen();
    error CaseAlreadyExists();
    error InvalidReading();
    error AttestationWindowExpired();
    error NotRegisteredOracle();
    error AlreadyAttested();
    error CaseNotEvaluated();
    error InvalidAddress();

    // ==============================
    // CONSTRUCTOR
    // ==============================
    
    /**
     * @notice Deploy inspection protocol
     * @param _oracleRegistry Address of OracleRegistry contract
     */
    constructor(address _oracleRegistry) {
        if (_oracleRegistry == address(0)) revert InvalidAddress();
        oracleRegistry = _oracleRegistry;
    }

    // ==============================
    // CASE MANAGEMENT
    // ==============================
    
    /**
     * @notice Open an inspection case for a citizen
     * @param citizen Citizen address
     * @param reportedReading Citizen's reported meter reading
     * @param previousReading Previous meter reading on record
     * @param historicalAverage Historical average consumption (6-month)
     * @return caseId Unique case identifier
     * @dev Anyone can open a case (typically triggered by anomaly detection)
     */
    function openCase(
        address citizen,
        uint256 reportedReading,
        uint256 previousReading,
        uint256 historicalAverage
    ) external returns (bytes32 caseId) {
        if (citizen == address(0)) revert InvalidAddress();
        
        // Generate unique case ID
        caseId = keccak256(
            abi.encodePacked(
                citizen,
                reportedReading,
                block.timestamp,
                totalCases
            )
        );
        
        if (cases[caseId].openedAt != 0) revert CaseAlreadyExists();
        
        // Validate reading sequence
        if (!WaterRules.isValidReadingSequence(previousReading, reportedReading)) {
            revert InvalidReading();
        }
        
        // Create case
        cases[caseId] = InspectionCase({
            caseId: caseId,
            citizen: citizen,
            reportedReading: reportedReading,
            previousReading: previousReading,
            historicalAverage: historicalAverage,
            actualReading: 0,
            attestationHash: bytes32(0),
            attestingOracle: address(0),
            openedAt: block.timestamp,
            evaluatedAt: 0,
            status: CaseStatus.Open,
            outcome: Outcome.Pending,
            dropPercentBps: 0,
            measurementDelta: 0
        });
        
        citizenCases[citizen].push(caseId);
        totalCases++;
        outcomeCount[Outcome.Pending]++;
        
        emit CaseOpened(
            caseId,
            citizen,
            reportedReading,
            previousReading,
            historicalAverage,
            block.timestamp
        );
    }

    /**
     * @notice Submit oracle attestation with actual reading
     * @param caseId Case identifier
     * @param actualReading Actual meter reading observed by oracle
     * @param attestationHash Hash of full attestation data (stored off-chain)
     * @dev Oracle must be registered in OracleRegistry
     */
    function submitAttestation(
        bytes32 caseId,
        uint256 actualReading,
        bytes32 attestationHash
    ) external {
        InspectionCase storage inspectionCase = cases[caseId];
        
        if (inspectionCase.openedAt == 0) revert CaseNotFound();
        if (inspectionCase.status != CaseStatus.Open) revert CaseNotOpen();
        if (inspectionCase.attestingOracle != address(0)) revert AlreadyAttested();
        
        // Check attestation window
        if (block.timestamp > inspectionCase.openedAt + ATTESTATION_WINDOW) {
            revert AttestationWindowExpired();
        }
        
        // Validate oracle registration (call OracleRegistry)
        if (!_isRegisteredOracle(msg.sender)) {
            revert NotRegisteredOracle();
        }
        
        // Record attestation
        inspectionCase.actualReading = actualReading;
        inspectionCase.attestationHash = attestationHash;
        inspectionCase.attestingOracle = msg.sender;
        
        emit AttestationReceived(
            caseId,
            msg.sender,
            attestationHash,
            actualReading,
            block.timestamp
        );
        
        // Automatically evaluate
        _evaluateCase(caseId);
    }

    /**
     * @notice Expire a case that received no attestation
     * @param caseId Case identifier
     * @dev Anyone can call after AUTO_RESOLVE_WINDOW
     */
    function expireCase(bytes32 caseId) external {
        InspectionCase storage inspectionCase = cases[caseId];
        
        if (inspectionCase.openedAt == 0) revert CaseNotFound();
        if (inspectionCase.status != CaseStatus.Open) revert CaseNotOpen();
        
        // Must be past auto-resolve window
        if (block.timestamp <= inspectionCase.openedAt + AUTO_RESOLVE_WINDOW) {
            revert AttestationWindowExpired();
        }
        
        // Mark as expired - citizen is not penalized (no oracle response)
        inspectionCase.status = CaseStatus.Expired;
        inspectionCase.outcome = Outcome.Clean;
        inspectionCase.evaluatedAt = block.timestamp;
        
        // Update counters
        outcomeCount[Outcome.Pending]--;
        outcomeCount[Outcome.Clean]++;
        
        emit CaseExpired(caseId, inspectionCase.citizen, block.timestamp);
    }

    /**
     * @notice Close an evaluated case
     * @param caseId Case identifier
     * @dev Can only close evaluated or expired cases
     */
    function closeCase(bytes32 caseId) external {
        InspectionCase storage inspectionCase = cases[caseId];
        
        if (inspectionCase.openedAt == 0) revert CaseNotFound();
        if (inspectionCase.status == CaseStatus.Open) revert CaseNotEvaluated();
        if (inspectionCase.status == CaseStatus.Closed) revert CaseNotOpen();
        
        inspectionCase.status = CaseStatus.Closed;
        
        emit CaseClosed(caseId, inspectionCase.outcome, block.timestamp);
    }

    // ==============================
    // INTERNAL EVALUATION
    // ==============================
    
    /**
     * @notice Evaluate case using WaterRules library
     * @param caseId Case identifier
     * @dev Pure rule-based evaluation, no discretion
     */
    function _evaluateCase(bytes32 caseId) internal {
        InspectionCase storage inspectionCase = cases[caseId];
        
        // Calculate reported consumption
        uint256 reportedConsumption = WaterRules.calculateConsumption(
            inspectionCase.previousReading,
            inspectionCase.reportedReading
        );
        
        // Calculate actual consumption
        uint256 actualConsumption = WaterRules.calculateConsumption(
            inspectionCase.previousReading,
            inspectionCase.actualReading
        );
        
        // Evaluate consumption anomaly (drop from historical)
        (bool hasAnomaly, uint256 dropBps) = WaterRules.evaluateConsumptionChange(
            reportedConsumption,
            inspectionCase.historicalAverage
        );
        
        // Evaluate measurement tolerance
        (bool withinTolerance, uint256 delta) = WaterRules.evaluateMeasurement(
            inspectionCase.reportedReading,
            inspectionCase.actualReading,
            TOLERANCE_BPS
        );
        
        // Store metrics
        inspectionCase.dropPercentBps = dropBps;
        inspectionCase.measurementDelta = delta;
        inspectionCase.evaluatedAt = block.timestamp;
        inspectionCase.status = CaseStatus.Evaluated;
        
        // Classify outcome using deterministic rules
        Outcome outcome = _classifyOutcome(hasAnomaly, withinTolerance, delta);
        inspectionCase.outcome = outcome;
        
        // Update counters
        outcomeCount[Outcome.Pending]--;
        outcomeCount[outcome]++;
        
        emit CaseEvaluated(
            caseId,
            inspectionCase.citizen,
            outcome,
            dropBps,
            delta,
            withinTolerance,
            block.timestamp
        );
    }
    
    /**
     * @notice Classify outcome based on rule evaluation
     * @param hasAnomaly Whether consumption anomaly was detected
     * @param withinTolerance Whether measurement is within tolerance
     * @param delta Measurement discrepancy
     * @return Outcome classification
     * @dev Pure deterministic logic:
     *      - Within tolerance + no delta → CLEAN
     *      - Within tolerance + has anomaly → WARNING
     *      - Outside tolerance → FRAUD
     */
    function _classifyOutcome(
        bool hasAnomaly,
        bool withinTolerance,
        uint256 delta
    ) internal pure returns (Outcome) {
        // If measurement within tolerance
        if (withinTolerance) {
            // No discrepancy at all
            if (delta == 0) {
                return Outcome.Clean;
            }
            // Small discrepancy but anomaly detected
            if (hasAnomaly) {
                return Outcome.Warning;
            }
            // Small discrepancy, no anomaly
            return Outcome.Clean;
        }
        
        // Outside tolerance = fraud
        return Outcome.Fraud;
    }

    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    /**
     * @notice Get full case details
     */
    function getCase(bytes32 caseId) external view returns (InspectionCase memory) {
        return cases[caseId];
    }
    
    /**
     * @notice Get case outcome
     */
    function getCaseOutcome(bytes32 caseId) external view returns (Outcome) {
        return cases[caseId].outcome;
    }
    
    /**
     * @notice Get case status
     */
    function getCaseStatus(bytes32 caseId) external view returns (CaseStatus) {
        return cases[caseId].status;
    }
    
    /**
     * @notice Check if case is fraud
     */
    function isFraud(bytes32 caseId) external view returns (bool) {
        return cases[caseId].outcome == Outcome.Fraud;
    }
    
    /**
     * @notice Get citizen's cases
     */
    function getCitizenCases(address citizen) external view returns (bytes32[] memory) {
        return citizenCases[citizen];
    }
    
    /**
     * @notice Get outcome statistics
     */
    function getOutcomeStats() external view returns (
        uint256 clean,
        uint256 warning,
        uint256 fraud,
        uint256 pending
    ) {
        return (
            outcomeCount[Outcome.Clean],
            outcomeCount[Outcome.Warning],
            outcomeCount[Outcome.Fraud],
            outcomeCount[Outcome.Pending]
        );
    }
    
    /**
     * @notice Check if case exists
     */
    function caseExists(bytes32 caseId) external view returns (bool) {
        return cases[caseId].openedAt != 0;
    }

    // ==============================
    // INTERNAL HELPERS
    // ==============================
    
    /**
     * @notice Check if address is registered oracle
     * @param oracle Address to check
     * @return True if registered
     */
    function _isRegisteredOracle(address oracle) internal view returns (bool) {
        // Call OracleRegistry.isOracle(oracle)
        (bool success, bytes memory data) = oracleRegistry.staticcall(
            abi.encodeWithSignature("isOracle(address)", oracle)
        );
        
        if (!success || data.length == 0) {
            return false;
        }
        
        return abi.decode(data, (bool));
    }
}
