// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./EcoCivicDeposit.sol";

/**
 * @title SlashingManager
 * @notice Davranis ihlallerinde kullanicilarin depozitlerinden kesinti yapmak icin
 *         basit bir yonetim kontrati.
 *
 * Bu kontrat su asamalari saglar:
 * - Belediye (owner) belirli bir kullanicinin ihlal yaptigina karar verdiginde
 *   `slashUser` cagrisiyla EcoCivicDeposit uzerinden fon ceker.
 * - Kontrat sadece EcoCivicDeposit kontratinin sahibi olacak sekilde kurgulanmalidir
 *   (deploy sirasinda veya sonrasinda ownership devriyle).
 */
contract SlashingManager is Ownable {
    EcoCivicDeposit public immutable depositContract;

    event UserSlashed(address indexed user, uint256 amount, string reason);

    constructor(address _depositContract) Ownable(msg.sender) {
        depositContract = EcoCivicDeposit(_depositContract);
    }

    /**
     * @notice Kullanici depozitosundan belirli miktar kesinti yapar.
     * @dev Bu fonksiyon, SlashingManager'in EcoCivicDeposit kontratinin owner'i
     *      oldugu varsayimiyla calisir. Gercek projede, sehir/belediye tarafindaki
     *      yonetim bu kontrati kontrol etmelidir.
     *
     *      Kesilen miktar bu kontrata cekilir; sonrasinda belediye istedigi yere
     *      transfer edebilir (ornegin cevre fonu).
     */
    function slashUser(
        address user,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(amount > 0, "Amount must be > 0");

        // EcoCivicDeposit'taki userDeposits toplamindan daha fazla kesmeye izin verme
        uint256 currentDeposit = depositContract.getUserDeposit(user);
        require(amount <= currentDeposit, "Cannot slash more than user deposit");

        // Fonlari EcoCivicDeposit'tan bu kontrata ceker
        depositContract.withdraw(amount, address(this));

        emit UserSlashed(user, amount, reason);
    }
}

// SlashingManager.sol dosyasi