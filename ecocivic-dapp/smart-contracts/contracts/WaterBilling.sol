// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./BELTToken.sol";

/**
 * @title WaterBilling
 * @notice Su sayacı endeksine göre fatura ödeme ve ödül dağıtımı.
 */
contract WaterBilling is AccessControl {
    bytes32 public constant SERVICE_OPERATOR_ROLE = keccak256("SERVICE_OPERATOR_ROLE");
    
    BELTToken public immutable beltToken;

    // Son bilinen endeks
    mapping(address => uint256) public lastReading;

    event ReadingSubmitted(address indexed user, uint256 newReading, uint256 rewardAmount);

    constructor(address _beltToken) {
        beltToken = BELTToken(_beltToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SERVICE_OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Yetkili operatör (Backend) tarafından sayaç okuması girilir.
     * @param user Kullanıcı adresi
     * @param newReading Yeni endeks değeri
     */
    function submitReading(address user, uint256 newReading) external onlyRole(SERVICE_OPERATOR_ROLE) {
        require(user != address(0), "Invalid user address");
        require(newReading > 0, "Reading must be > 0");

        uint256 previous = lastReading[user];
        require(newReading > previous, "New reading must be greater than last reading");

        uint256 delta = newReading - previous;
        lastReading[user] = newReading;

        // Backend'den gelen onayla ödül veriliyor
        uint256 rewardAmount = delta; 
        if (rewardAmount > 0) {
            beltToken.mint(user, rewardAmount);
        }

        emit ReadingSubmitted(user, newReading, rewardAmount);
    }
}