// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EcoCivicDepositV2
 * @notice Decentralized deposit contract for citizens and oracles
 * @dev NO admin authority. NO manual slashing. Slashing only via authorized protocol contracts.
 * 
 * Design Principles:
 * - Authorized protocols are immutable at deployment
 * - No owner, no pause, no emergency withdraw
 * - Slashing is consequence of deterministic rule evaluation in protocol contracts
 * - Deposits locked while active cases exist
 */
contract EcoCivicDepositV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==============================
    // TYPES
    // ==============================
    
    enum DepositType {
        Citizen,    // Regular user deposit
        Oracle      // Inspector/staff oracle deposit
    }
    
    struct Deposit {
        uint256 totalAmount;        // Total deposited
        uint256 lockedAmount;       // Locked in active cases
        uint256 slashedAmount;      // Total slashed historically
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
    
    /// @notice Authorized protocol contracts that can call slash()
    /// @dev Set at deployment, immutable thereafter
    mapping(address => bool) public authorizedProtocols;
    
    /// @notice List of authorized protocols for enumeration
    address[] public protocolList;
    
    /// @notice User deposits
    mapping(address => Deposit) public deposits;
    
    /// @notice Case-based locks: caseId => CaseLock
    mapping(bytes32 => CaseLock) public caseLocks;
    
    /// @notice User's active cases count
    mapping(address => uint256) public activeCaseCount;
    
    /// @notice User's case IDs for enumeration
    mapping(address => bytes32[]) public userCases;
    
    /// @notice Minimum deposit amounts by type
    uint256 public immutable minCitizenDeposit;
    uint256 public immutable minOracleDeposit;
    
    /// @notice Treasury address for slashed funds (immutable, no control)
    address public immutable treasuryAddress;
    
    /// @notice Total slashed amount held in treasury
    uint256 public totalSlashedToTreasury;

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
        uint256 amount, 
        address indexed slashedBy
    );
    
    event SlashDistributed(
        bytes32 indexed caseId,
        uint256 toTreasury,
        address indexed beneficiary,
        uint256 toBeneficiary
    );

    // ==============================
    // ERRORS
    // ==============================
    
    error Unauthorized();
    error InvalidAddress();
    error InsufficientDeposit();
    error InsufficientUnlockedBalance();
    error ActiveCasesExist();
    error CaseNotFound();
    error CaseNotActive();
    error CaseAlreadyExists();
    error AmountTooLow();
    error ZeroAmount();
    error AlreadyInitialized();
    error NotInitialized();
    error DepositTypeMismatch();
    error InvalidBps();

    // ==============================
    // MODIFIERS
    // ==============================
    
    modifier onlyAuthorizedProtocol() {
        if (!authorizedProtocols[msg.sender]) revert Unauthorized();
        _;
    }
    
    modifier validAddress(address addr) {
        if (addr == address(0)) revert InvalidAddress();
        _;
    }

    // ==============================
    // CONSTRUCTOR
    // ==============================
    
    /**
     * @notice Deploy with immutable configuration
     * @param _depositToken BELT token address
     * @param _authorizedProtocols Array of protocol contract addresses that can slash
     * @param _treasuryAddress Address where slashed funds go
     * @param _minCitizenDeposit Minimum deposit for citizens
     * @param _minOracleDeposit Minimum deposit for oracles
     */
    constructor(
        address _depositToken,
        address[] memory _authorizedProtocols,
        address _treasuryAddress,
        uint256 _minCitizenDeposit,
        uint256 _minOracleDeposit
    ) {
        if (_depositToken == address(0)) revert InvalidAddress();
        if (_treasuryAddress == address(0)) revert InvalidAddress();
        if (_authorizedProtocols.length == 0) revert InvalidAddress();
        
        depositToken = IERC20(_depositToken);
        treasuryAddress = _treasuryAddress;
        minCitizenDeposit = _minCitizenDeposit;
        minOracleDeposit = _minOracleDeposit;
        
        // Set authorized protocols - IMMUTABLE after deployment
        for (uint256 i = 0; i < _authorizedProtocols.length; i++) {
            if (_authorizedProtocols[i] == address(0)) revert InvalidAddress();
            authorizedProtocols[_authorizedProtocols[i]] = true;
            protocolList.push(_authorizedProtocols[i]);
        }
    }

    // ==============================
    // DEPOSIT FUNCTIONS
    // ==============================
    
    /**
     * @notice Deposit BELT tokens as a citizen
     * @param amount Amount to deposit
     */
    function depositAsCitizen(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount, DepositType.Citizen, minCitizenDeposit);
    }
    
    /**
     * @notice Deposit BELT tokens as an oracle (inspector/staff)
     * @param amount Amount to deposit
     */
    function depositAsOracle(uint256 amount) external nonReentrant {
        _deposit(msg.sender, amount, DepositType.Oracle, minOracleDeposit);
    }
    
    /**
     * @notice Add to existing deposit
     * @param amount Amount to add
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
     * @param amount Amount to withdraw
     * @dev Users can withdraw unlocked balance even with active cases
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
    // CASE LOCK FUNCTIONS (Protocol Only)
    // ==============================
    
    /**
     * @notice Lock a portion of user's deposit for a case
     * @dev Only callable by authorized protocol contracts
     * @param user User address
     * @param caseId Unique case identifier
     * @param amount Amount to lock
     */
    function lockForCase(
        address user, 
        bytes32 caseId, 
        uint256 amount
    ) 
        external 
        onlyAuthorizedProtocol 
        validAddress(user) 
        nonReentrant 
    {
        if (amount == 0) revert ZeroAmount();
        if (caseLocks[caseId].active) revert CaseAlreadyExists();
        
        Deposit storage dep = deposits[user];
        if (!dep.initialized) revert NotInitialized();
        
        uint256 available = dep.totalAmount - dep.lockedAmount;
        if (amount > available) revert InsufficientUnlockedBalance();
        
        // Create case lock
        caseLocks[caseId] = CaseLock({
            user: user,
            amount: amount,
            active: true,
            createdAt: block.timestamp
        });
        
        // Update deposit state
        dep.lockedAmount += amount;
        activeCaseCount[user]++;
        userCases[user].push(caseId);
        
        emit DepositLocked(user, caseId, amount);
    }
    
    /**
     * @notice Unlock deposit after case resolution (no penalty)
     * @dev Only callable by authorized protocol contracts
     * @param caseId Case identifier
     */
    function unlockCase(bytes32 caseId) 
        external 
        onlyAuthorizedProtocol 
        nonReentrant 
    {
        CaseLock storage caseLock = caseLocks[caseId];
        if (!caseLock.active) revert CaseNotActive();
        
        address user = caseLock.user;
        uint256 amount = caseLock.amount;
        
        // Update deposit state
        Deposit storage dep = deposits[user];
        dep.lockedAmount -= amount;
        activeCaseCount[user]--;
        
        // Mark case as resolved
        caseLock.active = false;
        
        emit DepositUnlocked(user, caseId, amount);
    }
    
    // ==============================
    // SLASH FUNCTION (Protocol Only)
    // ==============================
    
    /**
     * @notice Slash a user's locked deposit for a specific case
     * @dev Only callable by authorized protocol contracts as consequence of rule evaluation
     * @param caseId Case identifier with locked funds
     * @param slashAmount Amount to slash (must be <= locked amount)
     * @param beneficiary Optional address to receive portion of slash (address(0) = all to treasury)
     * @param beneficiaryShare Percentage to beneficiary in basis points (0-10000)
     */
    function slash(
        bytes32 caseId,
        uint256 slashAmount,
        address beneficiary,
        uint256 beneficiaryShare
    ) 
        external 
        onlyAuthorizedProtocol 
        nonReentrant 
    {
        CaseLock storage caseLock = caseLocks[caseId];
        if (!caseLock.active) revert CaseNotActive();
        if (slashAmount == 0) revert ZeroAmount();
        if (slashAmount > caseLock.amount) revert InsufficientDeposit();
        if (beneficiaryShare > 10000) revert InvalidBps();
        
        address user = caseLock.user;
        Deposit storage dep = deposits[user];
        
        // Update deposit accounting
        dep.totalAmount -= slashAmount;
        dep.lockedAmount -= slashAmount;
        dep.slashedAmount += slashAmount;
        caseLock.amount -= slashAmount;
        
        // If case fully slashed, close it
        if (caseLock.amount == 0) {
            caseLock.active = false;
            activeCaseCount[user]--;
        }
        
        // Distribute slashed funds
        uint256 toBeneficiary = 0;
        uint256 toTreasury = slashAmount;
        
        if (beneficiary != address(0) && beneficiaryShare > 0) {
            toBeneficiary = (slashAmount * beneficiaryShare) / 10000;
            toTreasury = slashAmount - toBeneficiary;
            depositToken.safeTransfer(beneficiary, toBeneficiary);
        }
        
        if (toTreasury > 0) {
            depositToken.safeTransfer(treasuryAddress, toTreasury);
            totalSlashedToTreasury += toTreasury;
        }
        
        emit DepositSlashed(user, caseId, slashAmount, msg.sender);
        emit SlashDistributed(caseId, toTreasury, beneficiary, toBeneficiary);
    }
    
    /**
     * @notice Slash and close case in single transaction
     * @dev Convenience function for full slash scenarios
     */
    function slashAndClose(
        bytes32 caseId,
        address beneficiary,
        uint256 beneficiaryShare
    ) 
        external 
        onlyAuthorizedProtocol 
        nonReentrant 
    {
        CaseLock storage caseLock = caseLocks[caseId];
        if (!caseLock.active) revert CaseNotActive();
        
        uint256 slashAmount = caseLock.amount;
        address user = caseLock.user;
        Deposit storage dep = deposits[user];
        
        // Update deposit accounting
        dep.totalAmount -= slashAmount;
        dep.lockedAmount -= slashAmount;
        dep.slashedAmount += slashAmount;
        
        // Close case
        caseLock.amount = 0;
        caseLock.active = false;
        activeCaseCount[user]--;
        
        // Distribute slashed funds
        uint256 toBeneficiary = 0;
        uint256 toTreasury = slashAmount;
        
        if (beneficiaryShare > 10000) revert InvalidBps();
        
        if (beneficiary != address(0) && beneficiaryShare > 0) {
            toBeneficiary = (slashAmount * beneficiaryShare) / 10000;
            toTreasury = slashAmount - toBeneficiary;
            depositToken.safeTransfer(beneficiary, toBeneficiary);
        }
        
        if (toTreasury > 0) {
            depositToken.safeTransfer(treasuryAddress, toTreasury);
            totalSlashedToTreasury += toTreasury;
        }
        
        emit DepositSlashed(user, caseId, slashAmount, msg.sender);
        emit SlashDistributed(caseId, toTreasury, beneficiary, toBeneficiary);
    }

    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    /**
     * @notice Get user's available (unlocked) balance
     */
    function getAvailableBalance(address user) external view returns (uint256) {
        Deposit storage dep = deposits[user];
        if (!dep.initialized) return 0;
        return dep.totalAmount - dep.lockedAmount;
    }
    
    /**
     * @notice Get user's total deposit info
     */
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
    
    /**
     * @notice Get case lock details
     */
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
        CaseLock storage caseLock = caseLocks[caseId];
        return (caseLock.user, caseLock.amount, caseLock.active, caseLock.createdAt);
    }
    
    /**
     * @notice Get user's active case IDs
     */
    function getUserCases(address user) external view returns (bytes32[] memory) {
        return userCases[user];
    }
    
    /**
     * @notice Get all authorized protocol addresses
     */
    function getAuthorizedProtocols() external view returns (address[] memory) {
        return protocolList;
    }
    
    /**
     * @notice Check if user has sufficient deposit for a new case
     */
    function hasAvailableDeposit(address user, uint256 amount) external view returns (bool) {
        Deposit storage dep = deposits[user];
        if (!dep.initialized) return false;
        return (dep.totalAmount - dep.lockedAmount) >= amount;
    }
    
    /**
     * @notice Check if address is authorized protocol
     */
    function isAuthorized(address protocol) external view returns (bool) {
        return authorizedProtocols[protocol];
    }

    // ==============================
    // INTERNAL FUNCTIONS
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
            // Adding to existing deposit - must match type
            if (dep.depositType != depositType) revert DepositTypeMismatch();
        } else {
            // Initialize new deposit
            dep.initialized = true;
            dep.depositType = depositType;
        }
        
        depositToken.safeTransferFrom(user, address(this), amount);
        dep.totalAmount += amount;
        
        emit DepositMade(user, amount, depositType, dep.totalAmount);
    }
}
