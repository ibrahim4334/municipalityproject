// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IInspectionProtocol
 * @notice Interface for InspectionProtocol contract
 */
interface IInspectionProtocol {
    function isFraud(bytes32 caseId) external view returns (bool);
    function getCase(bytes32 caseId) external view returns (
        bytes32 caseId_,
        address citizen,
        uint256 reportedReading,
        uint256 previousReading,
        uint256 historicalAverage,
        uint256 actualReading,
        bytes32 attestationHash,
        address attestingOracle,
        uint256 openedAt,
        uint256 evaluatedAt,
        uint8 status,
        uint8 outcome,
        uint256 dropPercentBps,
        uint256 measurementDelta
    );
}

/**
 * @title EcoCivicDepositV2
 * @notice Passive deposit vault that reacts ONLY to InspectionProtocol verdicts
 * @dev Blockchain-first justice: no admin, no manual slashing, no privileged roles
 * 
 * Design Principles:
 * - InspectionProtocol is the ONLY authority
 * - No manual slashing paths
 * - No admin override
 * - Slashing is automatic consequence of fraud verdict
 * - This contract is a passive vault, not an actor
 */
contract EcoCivicDepositV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==============================
    // TYPES
    // ==============================
    
    enum DepositType {
        Citizen,
        Oracle
    }
    
    struct Deposit {
        uint256 totalAmount;
        uint256 lockedAmount;
        uint256 slashedAmount;
        DepositType depositType;
        bool initialized;
    }
    
    struct CaseLock {
        address user;
        uint256 amount;
        bool active;
        uint256 createdAt;
    }

    // ==============================
    // STATE
    // ==============================
    
    /// @notice The deposit token (BELT)
    IERC20 public immutable depositToken;
    
    /// @notice InspectionProtocol contract (immutable, sole authority)
    IInspectionProtocol public immutable inspectionProtocol;
    
    /// @notice User deposits
    mapping(address => Deposit) public deposits;
    
    /// @notice Case-based locks: caseId => CaseLock
    mapping(bytes32 => CaseLock) public caseLocks;
    
    /// @notice User's active cases count
    mapping(address => uint256) public activeCaseCount;
    
    /// @notice User's case IDs for enumeration
    mapping(address => bytes32[]) public userCases;
    
    /// @notice Track if inspection outcome was executed
    mapping(bytes32 => bool) public outcomeExecuted;
    
    /// @notice Minimum deposit amounts
    uint256 public immutable minCitizenDeposit;
    uint256 public immutable minOracleDeposit;
    
    /// @notice Treasury address for slashed funds (immutable)
    address public immutable treasuryAddress;
    
    /// @notice Total slashed to treasury
    uint256 public totalSlashedToTreasury;
    
    /// @notice Fraud slash rate: 50% = 5000 bps
    uint256 public constant FRAUD_SLASH_BPS = 5000;

    // ==============================
    // EVENTS
    // ==============================
    
    event DepositMade(
        address indexed user, 
        uint256 amount, 
        DepositType depositType,
        uint256 newTotal
    );
    
    event DepositWithdrawn(
        address indexed user, 
        uint256 amount, 
        uint256 remaining
    );
    
    event DepositLocked(
        address indexed user, 
        bytes32 indexed caseId, 
        uint256 amount
    );
    
    event DepositUnlocked(
        address indexed user, 
        bytes32 indexed caseId, 
        uint256 amount
    );
    
    event DepositSlashed(
        address indexed user, 
        bytes32 indexed caseId,
        uint256 amount
    );
    
    event InspectionOutcomeExecuted(
        bytes32 indexed caseId,
        address indexed citizen,
        bool isFraud,
        uint256 slashAmount
    );

    // ==============================
    // ERRORS
    // ==============================
    
    error InvalidAddress();
    error InsufficientDeposit();
    error InsufficientUnlockedBalance();
    error CaseNotFound();
    error CaseNotActive();
    error CaseAlreadyExists();
    error AmountTooLow();
    error ZeroAmount();
    error NotInitialized();
    error DepositTypeMismatch();
    error OutcomeAlreadyExecuted();
    error NotInspectionProtocol();

    // ==============================
    // MODIFIERS
    // ==============================
    
    modifier onlyInspectionProtocol() {
        if (msg.sender != address(inspectionProtocol)) revert NotInspectionProtocol();
        _;
    }

    // ==============================
    // CONSTRUCTOR
    // ==============================
    
    /**
     * @notice Deploy passive deposit vault
     * @param _depositToken BELT token address
     * @param _inspectionProtocol InspectionProtocol contract (sole authority)
     * @param _treasuryAddress Address where slashed funds go
     * @param _minCitizenDeposit Minimum deposit for citizens
     * @param _minOracleDeposit Minimum deposit for oracles
     */
    constructor(
        address _depositToken,
        address _inspectionProtocol,
        address _treasuryAddress,
        uint256 _minCitizenDeposit,
        uint256 _minOracleDeposit
    ) {
        if (_depositToken == address(0)) revert InvalidAddress();
        if (_inspectionProtocol == address(0)) revert InvalidAddress();
        if (_treasuryAddress == address(0)) revert InvalidAddress();
        
        depositToken = IERC20(_depositToken);
        inspectionProtocol = IInspectionProtocol(_inspectionProtocol);
        treasuryAddress = _treasuryAddress;
        minCitizenDeposit = _minCitizenDeposit;
        minOracleDeposit = _minOracleDeposit;
    }

    // ==============================
    // DEPOSIT FUNCTIONS
    // ==============================
    
    /**
     * @notice Deposit BELT tokens as a citizen
     */
    function depositAsCitizen(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount, DepositType.Citizen, minCitizenDeposit);
    }
    
    /**
     * @notice Deposit BELT tokens as an oracle
     */
    function depositAsOracle(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount, DepositType.Oracle, minOracleDeposit);
    }
    
    /**
     * @notice Add to existing deposit
     */
    function addDeposit(uint256 amount) external nonReentrant {
        Deposit storage dep = deposits[msg.sender];
        if (!dep.initialized) revert NotInitialized();
        if (amount == 0) revert ZeroAmount();
        
        depositToken.safeTransferFrom(msg.sender, address(this), amount);
        dep.totalAmount += amount;
        
        emit DepositMade(msg.sender, amount, dep.depositType, dep.totalAmount);
    }
    
    /**
     * @notice Withdraw unlocked deposit
     */
    function withdraw(uint256 amount) external nonReentrant {
        Deposit storage dep = deposits[msg.sender];
        if (!dep.initialized) revert NotInitialized();
        if (amount == 0) revert ZeroAmount();
        
        uint256 available = dep.totalAmount - dep.lockedAmount;
        if (amount > available) revert InsufficientUnlockedBalance();
        
        dep.totalAmount -= amount;
        depositToken.safeTransfer(msg.sender, amount);
        
        emit DepositWithdrawn(msg.sender, amount, dep.totalAmount);
    }
    
    // ==============================
    // CASE LOCK (InspectionProtocol Only)
    // ==============================
    
    /**
     * @notice Lock deposit for a case
     * @dev ONLY callable by InspectionProtocol
     */
    function lockForCase(
        address user, 
        bytes32 caseId, 
        uint256 amount
    ) 
        external 
        onlyInspectionProtocol 
        nonReentrant 
    {
        if (user == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (caseLocks[caseId].active) revert CaseAlreadyExists();
        
        Deposit storage dep = deposits[user];
        if (!dep.initialized) revert NotInitialized();
        
        uint256 available = dep.totalAmount - dep.lockedAmount;
        if (amount > available) revert InsufficientUnlockedBalance();
        
        caseLocks[caseId] = CaseLock({
            user: user,
            amount: amount,
            active: true,
            createdAt: block.timestamp
        });
        
        dep.lockedAmount += amount;
        activeCaseCount[user]++;
        userCases[user].push(caseId);
        
        emit DepositLocked(user, caseId, amount);
    }
    
    // ==============================
    // INSPECTION OUTCOME EXECUTION
    // ==============================
    
    /**
     * @notice Execute penalty based on InspectionProtocol verdict
     * @param caseId Case identifier
     * @dev ONLY callable by InspectionProtocol
     * @dev This is the ONLY way to slash deposits
     * 
     * Logic:
     * - Reads inspectionProtocol.isFraud(caseId)
     * - If fraud → slash 50% to treasury, unlock rest
     * - If not fraud → unlock all, no penalty
     */
    function executeInspectionOutcome(bytes32 caseId) 
        external 
        onlyInspectionProtocol 
        nonReentrant 
    {
        if (outcomeExecuted[caseId]) revert OutcomeAlreadyExecuted();
        outcomeExecuted[caseId] = true;
        
        CaseLock storage caseLock = caseLocks[caseId];
        if (!caseLock.active) revert CaseNotActive();
        
        address citizen = caseLock.user;
        uint256 lockedAmount = caseLock.amount;
        Deposit storage dep = deposits[citizen];
        
        bool isFraud = inspectionProtocol.isFraud(caseId);
        
        if (isFraud) {
            // FRAUD → Slash 50% to treasury
            uint256 slashAmount = (lockedAmount * FRAUD_SLASH_BPS) / 10000;
            uint256 remaining = lockedAmount - slashAmount;
            
            dep.totalAmount -= slashAmount;
            dep.lockedAmount -= lockedAmount;
            dep.slashedAmount += slashAmount;
            
            caseLock.amount = 0;
            caseLock.active = false;
            activeCaseCount[citizen]--;
            
            depositToken.safeTransfer(treasuryAddress, slashAmount);
            totalSlashedToTreasury += slashAmount;
            
            emit DepositSlashed(citizen, caseId, slashAmount);
            emit InspectionOutcomeExecuted(caseId, citizen, true, slashAmount);
            
            if (remaining > 0) {
                emit DepositUnlocked(citizen, caseId, remaining);
            }
        } else {
            // NO FRAUD → Unlock all
            dep.lockedAmount -= lockedAmount;
            caseLock.amount = 0;
            caseLock.active = false;
            activeCaseCount[citizen]--;
            
            emit DepositUnlocked(citizen, caseId, lockedAmount);
            emit InspectionOutcomeExecuted(caseId, citizen, false, 0);
        }
    }

    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    function getAvailableBalance(address user) external view returns (uint256) {
        Deposit storage dep = deposits[user];
        if (!dep.initialized) return 0;
        return dep.totalAmount - dep.lockedAmount;
    }
    
    function getDepositInfo(address user) 
        external 
        view 
        returns (
            uint256 total,
            uint256 locked,
            uint256 available,
            uint256 slashed,
            DepositType depositType,
            uint256 activeCases
        ) 
    {
        Deposit storage dep = deposits[user];
        if (!dep.initialized) {
            return (0, 0, 0, 0, DepositType.Citizen, 0);
        }
        return (
            dep.totalAmount,
            dep.lockedAmount,
            dep.totalAmount - dep.lockedAmount,
            dep.slashedAmount,
            dep.depositType,
            activeCaseCount[user]
        );
    }
    
    function getCaseLock(bytes32 caseId) 
        external 
        view 
        returns (
            address user,
            uint256 amount,
            bool active,
            uint256 createdAt
        ) 
    {
        CaseLock storage cl = caseLocks[caseId];
        return (cl.user, cl.amount, cl.active, cl.createdAt);
    }
    
    function getUserCases(address user) external view returns (bytes32[] memory) {
        return userCases[user];
    }
    
    function hasAvailableDeposit(address user, uint256 amount) external view returns (bool) {
        Deposit storage dep = deposits[user];
        if (!dep.initialized) return false;
        return (dep.totalAmount - dep.lockedAmount) >= amount;
    }
    
    function isOutcomeExecuted(bytes32 caseId) external view returns (bool) {
        return outcomeExecuted[caseId];
    }
    
    function getInspectionProtocol() external view returns (address) {
        return address(inspectionProtocol);
    }

    // ==============================
    // INTERNAL
    // ==============================
    
    function _deposit(
        address user, 
        uint256 amount, 
        DepositType depositType,
        uint256 minAmount
    ) internal {
        if (amount < minAmount) revert AmountTooLow();
        
        Deposit storage dep = deposits[user];
        
        if (dep.initialized) {
            if (dep.depositType != depositType) revert DepositTypeMismatch();
        } else {
            dep.initialized = true;
            dep.depositType = depositType;
        }
        
        depositToken.safeTransferFrom(user, address(this), amount);
        dep.totalAmount += amount;
        
        emit DepositMade(user, amount, depositType, dep.totalAmount);
    }
}
