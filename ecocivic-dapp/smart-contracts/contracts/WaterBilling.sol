// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./BELTToken.sol";

/**
 * @title WaterBilling
 * @notice Su sayacı endeksine göre fatura ödeme ve ödül dağıtımı için basit kontrat.
 *
 * Güvenlik Notları:
 * - Fatura ödemesi reentrancy'ye karşı hassas bir fonksiyon içermediği için
 *   ekstra guard kullanılmadı; yalnızca state güncellemesi + optional token mint var.
 * - Her adres için monoton artan sayaç okunması zorunlu tutulur (geri gitmesine izin verilmez),
 *   böylece basit suiistimaller engellenir.
 * - BELT ödül mantığı çok basit tutulmuştur; gerçek projede belediye mantığına göre
 *   revize edilmelidir.
 */
contract WaterBilling is Ownable {
    BELTToken public immutable beltToken;

    // Son bilinen endeks
    mapping(address => uint256) public lastReading;

    event BillPaid(address indexed user, uint256 newReading, uint256 rewardAmount);

    constructor(address _beltToken) Ownable(msg.sender) {
        beltToken = BELTToken(_beltToken);
    }

    /**
     * @notice Sayaç okumasına göre faturayı "öder" ve kullanıcıya sembolik BELT ödülü verir.
     * @dev Bu örnek kontrat ETH veya stablecoin ile gerçek tahsilat yapmaz, yalnızca
     *      demo/MVP amaçlı olarak endeks günceller ve ödül basar.
     * @param newReading Sayaçtaki yeni endeks değeri
     */
    function payBill(uint256 newReading) external {
        require(newReading > 0, "Reading must be > 0");

        uint256 previous = lastReading[msg.sender];
        require(newReading > previous, "New reading must be greater than last reading");

        uint256 delta = newReading - previous;
        lastReading[msg.sender] = newReading;

        // Çok basit ödül formülü: delta'nın 1:1 BELT olarak basılması
        // Gerçek projede mutlaka düzenlenmelidir.
        uint256 rewardAmount = delta;
        if (rewardAmount > 0) {
            beltToken.mint(msg.sender, rewardAmount);
        }

        emit BillPaid(msg.sender, newReading, rewardAmount);
    }
}

// WaterBilling.sol dosyasi