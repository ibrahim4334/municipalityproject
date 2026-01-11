// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./BELTToken.sol";

contract RecyclingRewards is AccessControl {

    bytes32 public constant SERVICE_OPERATOR_ROLE = keccak256("SERVICE_OPERATOR_ROLE");

    BELTToken public beltToken;

    enum MaterialType {
        Glass,
        Paper,
        Metal
    }

    mapping(MaterialType => uint256) public rewardMultiplier;
    mapping(string => bool) public usedQrHashes; // QR hash tekrar kullanım kontrolü
    bool public paused;

    uint256 public constant MAX_BASE_AMOUNT = 10000; // Max 10000 kg per transaction

    event RewardGranted(
        address indexed user,
        MaterialType material,
        uint256 amount,
        string qrHash
    );
    event Paused(address account);
    event Unpaused(address account);
    event RewardMultiplierUpdated(MaterialType material, uint256 newMultiplier);

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }

    constructor(address _beltToken) {
        require(_beltToken != address(0), "Invalid BELT token address");
        beltToken = BELTToken(_beltToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SERVICE_OPERATOR_ROLE, msg.sender); // Deployer also operator for testing

        // Katsayılar (10 = 1.0)
        rewardMultiplier[MaterialType.Glass] = 10;
        rewardMultiplier[MaterialType.Paper] = 15;
        rewardMultiplier[MaterialType.Metal] = 20;
    }

    /**
     * @notice QR doğrulaması sonrası ödül verilir
     * @dev Bu fonksiyon backend / belediye tarafından çağrılmalı
     */
    function rewardRecycling(
        address user,
        MaterialType material,
        uint256 baseAmount,
        string calldata qrHash
    ) external onlyRole(SERVICE_OPERATOR_ROLE) whenNotPaused validAddress(user) {
        require(baseAmount > 0, "Base amount must be > 0");
        require(baseAmount <= MAX_BASE_AMOUNT, "Base amount exceeds maximum");
        require(bytes(qrHash).length > 0, "QR hash cannot be empty");
        require(!usedQrHashes[qrHash], "QR hash already used");

        // Material type validation
        require(
            material == MaterialType.Glass || 
            material == MaterialType.Paper || 
            material == MaterialType.Metal,
            "Invalid material type"
        );

        uint256 reward = (baseAmount * rewardMultiplier[material]) / 10;
        require(reward > 0, "Reward calculation resulted in zero");

        // Mark QR hash as used
        usedQrHashes[qrHash] = true;

        beltToken.mint(user, reward);

        emit RewardGranted(user, material, reward, qrHash);
    }

    /**
     * @notice Reward multiplier güncelle
     */
    function setRewardMultiplier(MaterialType material, uint256 multiplier) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(multiplier > 0, "Multiplier must be > 0");
        require(multiplier <= 100, "Multiplier too high"); // Max 10x
        
        rewardMultiplier[material] = multiplier;
        emit RewardMultiplierUpdated(material, multiplier);
    }

    /**
     * @notice Contract'ı durdur (acil durumlar için)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Contract'ı devam ettir
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice QR hash'in kullanılıp kullanılmadığını kontrol et
     */
    function isQrHashUsed(string calldata qrHash) external view returns (bool) {
        return usedQrHashes[qrHash];
    }
}
