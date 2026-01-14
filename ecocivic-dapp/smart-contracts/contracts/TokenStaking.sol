// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./BELTToken.sol";

/**
 * @title TokenStaking
 * @notice BELT token staking ve bonus faiz sistemi
 * @dev Su + Geri dönüşüm ödüllerini birleştiren tokenomics
 */
contract TokenStaking is AccessControl, ReentrancyGuard {
    
    // ==============================
    // ROLES
    // ==============================
    bytes32 public constant REWARD_MANAGER_ROLE = keccak256("REWARD_MANAGER_ROLE");
    
    // ==============================
    // STATE VARIABLES
    // ==============================
    BELTToken public immutable beltToken;
    
    // Staking tiers
    struct StakingTier {
        uint256 minAmount;      // Minimum stake miktarı
        uint256 bonusRateBps;   // Bonus faiz oranı (basis points, 100 = 1%)
        uint256 lockPeriod;     // Kilitleme süresi (saniye)
        string tierName;
    }
    
    // User staking data
    struct UserStake {
        uint256 amount;
        uint256 startTime;
        uint256 lockEndTime;
        uint256 lastRewardClaim;
        uint8 tierIndex;
        bool active;
    }
    
    // Staking tiers (can be updated by admin)
    StakingTier[] public stakingTiers;
    
    // User stakes
    mapping(address => UserStake) public userStakes;
    
    // Total staked
    uint256 public totalStaked;
    
    // Base APY (applied to all stakers, additional to tier bonus)
    uint256 public baseAnnualRateBps = 500; // 5% base APY
    
    // Pause
    bool public paused;
    
    // ==============================
    // EVENTS
    // ==============================
    event Staked(address indexed user, uint256 amount, uint8 tierIndex, uint256 lockEndTime);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards);
    event RewardsClaimed(address indexed user, uint256 amount);
    event TierAdded(uint8 tierIndex, string tierName, uint256 minAmount, uint256 bonusRateBps);
    event TierUpdated(uint8 tierIndex, uint256 minAmount, uint256 bonusRateBps);
    event BaseRateUpdated(uint256 oldRate, uint256 newRate);
    event Paused(address account);
    event Unpaused(address account);
    
    // ==============================
    // MODIFIERS
    // ==============================
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier hasActiveStake(address user) {
        require(userStakes[user].active, "No active stake");
        _;
    }
    
    // ==============================
    // CONSTRUCTOR
    // ==============================
    constructor(address _beltToken) {
        require(_beltToken != address(0), "Invalid token address");
        
        beltToken = BELTToken(_beltToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REWARD_MANAGER_ROLE, msg.sender);
        
        // Initialize default tiers
        _initializeDefaultTiers();
    }
    
    function _initializeDefaultTiers() internal {
        // Bronze: 100+ BELT, 2% bonus, 30 days lock
        stakingTiers.push(StakingTier({
            minAmount: 100 * 10**18,
            bonusRateBps: 200,
            lockPeriod: 30 days,
            tierName: "Bronze"
        }));
        
        // Silver: 500+ BELT, 5% bonus, 90 days lock
        stakingTiers.push(StakingTier({
            minAmount: 500 * 10**18,
            bonusRateBps: 500,
            lockPeriod: 90 days,
            tierName: "Silver"
        }));
        
        // Gold: 2000+ BELT, 10% bonus, 180 days lock
        stakingTiers.push(StakingTier({
            minAmount: 2000 * 10**18,
            bonusRateBps: 1000,
            lockPeriod: 180 days,
            tierName: "Gold"
        }));
        
        // Platinum: 10000+ BELT, 15% bonus, 365 days lock
        stakingTiers.push(StakingTier({
            minAmount: 10000 * 10**18,
            bonusRateBps: 1500,
            lockPeriod: 365 days,
            tierName: "Platinum"
        }));
    }
    
    // ==============================
    // STAKING FUNCTIONS
    // ==============================
    
    /**
     * @notice Stake BELT tokens
     * @param amount Amount to stake
     * @param tierIndex Desired tier (0-3)
     */
    function stake(uint256 amount, uint8 tierIndex) 
        external 
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        require(tierIndex < stakingTiers.length, "Invalid tier");
        require(!userStakes[msg.sender].active, "Already staking");
        
        StakingTier storage tier = stakingTiers[tierIndex];
        require(amount >= tier.minAmount, "Amount below tier minimum");
        
        // Transfer tokens to this contract
        require(
            beltToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        uint256 lockEndTime = block.timestamp + tier.lockPeriod;
        
        userStakes[msg.sender] = UserStake({
            amount: amount,
            startTime: block.timestamp,
            lockEndTime: lockEndTime,
            lastRewardClaim: block.timestamp,
            tierIndex: tierIndex,
            active: true
        });
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, tierIndex, lockEndTime);
    }
    
    /**
     * @notice Add more tokens to existing stake
     * @param amount Additional amount
     */
    function addToStake(uint256 amount) 
        external 
        whenNotPaused
        hasActiveStake(msg.sender)
        nonReentrant
    {
        require(amount > 0, "Amount must be > 0");
        
        // First claim pending rewards
        _claimRewards(msg.sender);
        
        // Transfer additional tokens
        require(
            beltToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        userStakes[msg.sender].amount += amount;
        totalStaked += amount;
        
        // Check if eligible for higher tier
        _checkTierUpgrade(msg.sender);
    }
    
    /**
     * @notice Unstake tokens (after lock period)
     */
    function unstake() 
        external 
        hasActiveStake(msg.sender)
        nonReentrant
    {
        UserStake storage userStake = userStakes[msg.sender];
        require(block.timestamp >= userStake.lockEndTime, "Still locked");
        
        // Calculate and mint rewards
        uint256 rewards = calculatePendingRewards(msg.sender);
        uint256 stakedAmount = userStake.amount;
        
        // Update state
        userStake.active = false;
        userStake.amount = 0;
        totalStaked -= stakedAmount;
        
        // Transfer staked tokens back
        require(beltToken.transfer(msg.sender, stakedAmount), "Transfer failed");
        
        // Mint rewards
        if (rewards > 0) {
            beltToken.mint(msg.sender, rewards);
        }
        
        emit Unstaked(msg.sender, stakedAmount, rewards);
    }
    
    /**
     * @notice Emergency unstake (forfeits rewards, may have penalty)
     */
    function emergencyUnstake() 
        external 
        hasActiveStake(msg.sender)
        nonReentrant
    {
        UserStake storage userStake = userStakes[msg.sender];
        
        uint256 stakedAmount = userStake.amount;
        uint256 penalty = 0;
        
        // 10% penalty if before lock end
        if (block.timestamp < userStake.lockEndTime) {
            penalty = (stakedAmount * 1000) / 10000; // 10%
        }
        
        uint256 returnAmount = stakedAmount - penalty;
        
        // Update state
        userStake.active = false;
        userStake.amount = 0;
        totalStaked -= stakedAmount;
        
        // Transfer (minus penalty)
        require(beltToken.transfer(msg.sender, returnAmount), "Transfer failed");
        
        // Penalty goes to reward pool (stays in contract)
        
        emit Unstaked(msg.sender, returnAmount, 0);
    }
    
    /**
     * @notice Claim accumulated rewards without unstaking
     */
    function claimRewards() 
        external 
        hasActiveStake(msg.sender)
        nonReentrant
    {
        _claimRewards(msg.sender);
    }
    
    function _claimRewards(address user) internal {
        uint256 rewards = calculatePendingRewards(user);
        
        if (rewards > 0) {
            userStakes[user].lastRewardClaim = block.timestamp;
            beltToken.mint(user, rewards);
            emit RewardsClaimed(user, rewards);
        }
    }
    
    // ==============================
    // VIEW FUNCTIONS
    // ==============================
    
    /**
     * @notice Calculate pending rewards for a user
     */
    function calculatePendingRewards(address user) public view returns (uint256) {
        UserStake storage userStake = userStakes[user];
        
        if (!userStake.active || userStake.amount == 0) {
            return 0;
        }
        
        uint256 timeElapsed = block.timestamp - userStake.lastRewardClaim;
        
        // Get tier bonus
        StakingTier storage tier = stakingTiers[userStake.tierIndex];
        uint256 totalRateBps = baseAnnualRateBps + tier.bonusRateBps;
        
        // Calculate rewards: amount * rate * time / year
        uint256 rewards = (userStake.amount * totalRateBps * timeElapsed) / (10000 * 365 days);
        
        return rewards;
    }
    
    /**
     * @notice Get user's stake info
     */
    function getUserStakeInfo(address user) 
        external 
        view 
        returns (
            uint256 stakedAmount,
            uint256 pendingRewards,
            uint256 lockEndTime,
            uint8 tierIndex,
            string memory tierName,
            uint256 totalAPY,
            bool isLocked
        ) 
    {
        UserStake storage userStake = userStakes[user];
        
        if (!userStake.active) {
            return (0, 0, 0, 0, "", 0, false);
        }
        
        StakingTier storage tier = stakingTiers[userStake.tierIndex];
        
        return (
            userStake.amount,
            calculatePendingRewards(user),
            userStake.lockEndTime,
            userStake.tierIndex,
            tier.tierName,
            (baseAnnualRateBps + tier.bonusRateBps) / 100, // APY as percentage
            block.timestamp < userStake.lockEndTime
        );
    }
    
    /**
     * @notice Get all tier info
     */
    function getAllTiers() 
        external 
        view 
        returns (
            string[] memory names,
            uint256[] memory minAmounts,
            uint256[] memory bonusRates,
            uint256[] memory lockPeriods
        )
    {
        uint256 len = stakingTiers.length;
        
        names = new string[](len);
        minAmounts = new uint256[](len);
        bonusRates = new uint256[](len);
        lockPeriods = new uint256[](len);
        
        for (uint256 i = 0; i < len; i++) {
            names[i] = stakingTiers[i].tierName;
            minAmounts[i] = stakingTiers[i].minAmount;
            bonusRates[i] = stakingTiers[i].bonusRateBps;
            lockPeriods[i] = stakingTiers[i].lockPeriod;
        }
        
        return (names, minAmounts, bonusRates, lockPeriods);
    }
    
    // ==============================
    // INTERNAL FUNCTIONS
    // ==============================
    
    function _checkTierUpgrade(address user) internal {
        UserStake storage userStake = userStakes[user];
        uint256 currentAmount = userStake.amount;
        uint8 currentTier = userStake.tierIndex;
        
        // Check if eligible for higher tier
        for (uint8 i = uint8(stakingTiers.length) - 1; i > currentTier; i--) {
            if (currentAmount >= stakingTiers[i].minAmount) {
                userStake.tierIndex = i;
                // Extend lock period for new tier
                userStake.lockEndTime = block.timestamp + stakingTiers[i].lockPeriod;
                break;
            }
        }
    }
    
    // ==============================
    // ADMIN FUNCTIONS
    // ==============================
    
    function addTier(
        string calldata name,
        uint256 minAmount,
        uint256 bonusRateBps,
        uint256 lockPeriod
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        stakingTiers.push(StakingTier({
            minAmount: minAmount,
            bonusRateBps: bonusRateBps,
            lockPeriod: lockPeriod,
            tierName: name
        }));
        
        emit TierAdded(uint8(stakingTiers.length - 1), name, minAmount, bonusRateBps);
    }
    
    function updateTier(
        uint8 tierIndex,
        uint256 minAmount,
        uint256 bonusRateBps,
        uint256 lockPeriod
    ) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(tierIndex < stakingTiers.length, "Invalid tier");
        
        stakingTiers[tierIndex].minAmount = minAmount;
        stakingTiers[tierIndex].bonusRateBps = bonusRateBps;
        stakingTiers[tierIndex].lockPeriod = lockPeriod;
        
        emit TierUpdated(tierIndex, minAmount, bonusRateBps);
    }
    
    function setBaseRate(uint256 newRateBps) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(newRateBps <= 5000, "Rate too high"); // Max 50% APY
        
        uint256 oldRate = baseAnnualRateBps;
        baseAnnualRateBps = newRateBps;
        
        emit BaseRateUpdated(oldRate, newRateBps);
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }
}
