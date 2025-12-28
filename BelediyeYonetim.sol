// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./CevreToken.sol";

contract BelediyeYonetim {
    struct VatandasBilgileri {
        uint256 teminatMiktari;
        string sonBeyanFotografHash;
        uint256 beyanSayisi;
    }

    CevreToken public immutable cevreTokenAdresi;
    mapping(address => VatandasBilgileri) public vatandaslar;
    
    constructor(address _cevreTokenAdresi) {
        cevreTokenAdresi = CevreToken(_cevreTokenAdresi);
    }
    
    function teminatYatir() external payable {
        require(msg.value > 0, "Teminat sifirdan buyuk olmali");
        vatandaslar[msg.sender].teminatMiktari += msg.value;
    }

    function suSayaciBeyanEt(uint256 aylikTuketim, string memory fotografHash) external {
        vatandaslar[msg.sender].sonBeyanFotografHash = fotografHash;
        vatandaslar[msg.sender].beyanSayisi += 1;
        uint256 mintMiktari = aylikTuketim; // Kendi kurallarınıza göre değiştirilebilir
        cevreTokenAdresi.mint(msg.sender, mintMiktari);
    }

    function faturaOde(uint256 tokenMiktari) external {
        require(tokenMiktari > 0, "Token miktari sifirdan buyuk olmali");
        bool basarili = cevreTokenAdresi.transferFrom(msg.sender, address(this), tokenMiktari);
        require(basarili, "Token transferi basarisiz");
    }
}
