// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OracleRegistry
 * @notice Municipal authorization registry for inspection oracles
 * @dev Municipality-controlled registry. NOT a DAO. NOT decentralized governance.
 * 
 * Design:
 * - Municipality deploys and controls the contract
 * - Municipality is the ONLY authority that can register/remove oracles
 * - Oracles can NEVER self-register or self-deregister
 * - Oracles can submit attestations for cases
 * 
 * This contract does NOT:
 * ❌ Allow self-registration
 * ❌ Have DAO/voting logic
 * ❌ Have token staking
 * ❌ Have fraud/penalty logic
 */
contract OracleRegistry {

    // ==============================
    // ROLE CONSTANTS
    // ==============================
    
    bytes32 public constant WATER_INSPECTOR = keccak256("WATER_INSPECTOR");
    bytes32 public constant RECYCLING_INSPECTOR = keccak256("RECYCLING_INSPECTOR");
    bytes32 public constant IOT_SENSOR = keccak256("IOT_SENSOR");

    // ==============================
    // TYPES
    // ==============================
    
    struct Oracle {
        bytes32 role;           // Role identifier
        uint256 registeredAt;   // When registered by municipality
        bool isActive;          // Currently active
    }
    
    struct Attestation {
        address oracle;         // Who submitted
        bytes32 dataHash;       // Hash of data
        uint256 submittedAt;    // Timestamp
    }

    // ==============================
    // STATE
    // ==============================
    
    /// @notice Municipality address (immutable authority)
    address public immutable municipality;
    
    /// @notice Oracle data: address → Oracle
    mapping(address => Oracle) public oracles;
    
    /// @notice Attestations for a case: caseId → Attestation[]
    mapping(bytes32 => Attestation[]) public caseAttestations;
    
    /// @notice Quick lookup: caseId → oracle → index+1 (0 = not found)
    mapping(bytes32 => mapping(address => uint256)) private attestationIndex;
    
    /// @notice Total registered oracles
    uint256 public totalOracles;
    
    /// @notice Total active oracles
    uint256 public activeOracles;
    
    /// @notice Total attestations
    uint256 public totalAttestations;

    // ==============================
    // EVENTS
    // ==============================
    
    event OracleRegistered(
        address indexed oracle,
        bytes32 indexed role,
        uint256 timestamp
    );
    
    event OracleDeactivated(
        address indexed oracle,
        bytes32 indexed role,
        uint256 timestamp
    );
    
    event OracleReactivated(
        address indexed oracle,
        bytes32 indexed role,
        uint256 timestamp
    );
    
    event AttestationSubmitted(
        bytes32 indexed caseId,
        address indexed oracle,
        bytes32 dataHash,
        uint256 timestamp
    );

    // ==============================
    // ERRORS
    // ==============================
    
    error NotMunicipality();
    error OracleAlreadyRegistered();
    error OracleNotRegistered();
    error OracleNotActive();
    error InvalidRole();
    error InvalidAddress();
    error AlreadyAttested();

    // ==============================
    // MODIFIERS
    // ==============================
    
    modifier onlyMunicipality() {
        if (msg.sender != municipality) revert NotMunicipality();
        _;
    }
    
    modifier onlyActiveOracle() {
        if (!oracles[msg.sender].isActive) revert OracleNotActive();
        _;
    }

    // ==============================
    // CONSTRUCTOR
    // ==============================
    
    /**
     * @notice Deploy registry with municipality as authority
     * @param _municipality Address of municipality (immutable)
     */
    constructor(address _municipality) {
        if (_municipality == address(0)) revert InvalidAddress();
        municipality = _municipality;
    }

    // ==============================
    // MUNICIPALITY FUNCTIONS
    // ==============================
    
    /**
     * @notice Register a new oracle
     * @param oracle Address to register as oracle
     * @param role Role to assign (WATER_INSPECTOR, RECYCLING_INSPECTOR, IOT_SENSOR)
     * @dev Only callable by municipality
     */
    function registerOracle(address oracle, bytes32 role) external onlyMunicipality {
        if (oracle == address(0)) revert InvalidAddress();
        if (oracles[oracle].registeredAt != 0) revert OracleAlreadyRegistered();
        if (!_isValidRole(role)) revert InvalidRole();
        
        oracles[oracle] = Oracle({
            role: role,
            registeredAt: block.timestamp,
            isActive: true
        });
        
        totalOracles++;
        activeOracles++;
        
        emit OracleRegistered(oracle, role, block.timestamp);
    }
    
    /**
     * @notice Deactivate an oracle
     * @param oracle Address to deactivate
     * @dev Only callable by municipality. Oracle can be reactivated later.
     */
    function deactivateOracle(address oracle) external onlyMunicipality {
        Oracle storage oracleData = oracles[oracle];
        
        if (oracleData.registeredAt == 0) revert OracleNotRegistered();
        if (!oracleData.isActive) revert OracleNotActive();
        
        bytes32 role = oracleData.role;
        oracleData.isActive = false;
        
        activeOracles--;
        
        emit OracleDeactivated(oracle, role, block.timestamp);
    }
    
    /**
     * @notice Reactivate a previously deactivated oracle
     * @param oracle Address to reactivate
     * @dev Only callable by municipality
     */
    function reactivateOracle(address oracle) external onlyMunicipality {
        Oracle storage oracleData = oracles[oracle];
        
        if (oracleData.registeredAt == 0) revert OracleNotRegistered();
        if (oracleData.isActive) revert OracleAlreadyRegistered();
        
        oracleData.isActive = true;
        activeOracles++;
        
        emit OracleReactivated(oracle, oracleData.role, block.timestamp);
    }
    
    /**
     * @notice Change oracle's role
     * @param oracle Address of oracle
     * @param newRole New role to assign
     * @dev Only callable by municipality
     */
    function changeOracleRole(address oracle, bytes32 newRole) external onlyMunicipality {
        Oracle storage oracleData = oracles[oracle];
        
        if (oracleData.registeredAt == 0) revert OracleNotRegistered();
        if (!_isValidRole(newRole)) revert InvalidRole();
        
        oracleData.role = newRole;
    }

    // ==============================
    // ATTESTATION (Oracle Only)
    // ==============================
    
    /**
     * @notice Submit an attestation for a case
     * @param caseId Case identifier
     * @param dataHash Hash of the attested data
     * @dev Only active oracles can submit. One attestation per oracle per case.
     */
    function submitAttestation(bytes32 caseId, bytes32 dataHash) external onlyActiveOracle {
        // One attestation per oracle per case
        if (attestationIndex[caseId][msg.sender] != 0) revert AlreadyAttested();
        
        // Store attestation
        caseAttestations[caseId].push(Attestation({
            oracle: msg.sender,
            dataHash: dataHash,
            submittedAt: block.timestamp
        }));
        
        // Track index (1-based to distinguish from "not found")
        attestationIndex[caseId][msg.sender] = caseAttestations[caseId].length;
        
        totalAttestations++;
        
        emit AttestationSubmitted(caseId, msg.sender, dataHash, block.timestamp);
    }

    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    /**
     * @notice Check if address is any active oracle
     */
    function isOracle(address oracle) external view returns (bool) {
        return oracles[oracle].isActive;
    }
    
    /**
     * @notice Check if address is active oracle with specific role
     */
    function isRegisteredOracle(address oracle, bytes32 role) external view returns (bool) {
        Oracle storage o = oracles[oracle];
        return o.isActive && o.role == role;
    }
    
    /**
     * @notice Get oracle's role (returns bytes32(0) if not registered)
     */
    function getOracleRole(address oracle) external view returns (bytes32) {
        return oracles[oracle].role;
    }
    
    /**
     * @notice Get full oracle info
     */
    function getOracleInfo(address oracle) 
        external 
        view 
        returns (
            bytes32 role,
            uint256 registeredAt,
            bool isActive
        ) 
    {
        Oracle storage o = oracles[oracle];
        return (o.role, o.registeredAt, o.isActive);
    }
    
    /**
     * @notice Get all attestations for a case
     */
    function getAttestations(bytes32 caseId) external view returns (Attestation[] memory) {
        return caseAttestations[caseId];
    }
    
    /**
     * @notice Get attestation count for a case
     */
    function getAttestationCount(bytes32 caseId) external view returns (uint256) {
        return caseAttestations[caseId].length;
    }
    
    /**
     * @notice Check if oracle has attested for a case
     */
    function hasAttested(bytes32 caseId, address oracle) external view returns (bool) {
        return attestationIndex[caseId][oracle] != 0;
    }
    
    /**
     * @notice Get specific oracle's attestation for a case
     */
    function getOracleAttestation(bytes32 caseId, address oracle) 
        external 
        view 
        returns (bytes32 dataHash, uint256 submittedAt) 
    {
        uint256 idx = attestationIndex[caseId][oracle];
        if (idx == 0) return (bytes32(0), 0);
        
        Attestation storage att = caseAttestations[caseId][idx - 1];
        return (att.dataHash, att.submittedAt);
    }

    // ==============================
    // INTERNAL
    // ==============================
    
    function _isValidRole(bytes32 role) internal pure returns (bool) {
        return role == WATER_INSPECTOR || 
               role == RECYCLING_INSPECTOR || 
               role == IOT_SENSOR;
    }
}
