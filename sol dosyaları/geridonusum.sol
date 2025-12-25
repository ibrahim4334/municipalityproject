// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBelediyeToken {
    function odulVer(address vatandas, uint256 miktar) external;
}

contract GeriDonusum {
    address public belediye;
    IBelediyeToken public tokenKontrati;
    
    struct Talep {
        uint256 olusturulmaZamani;
        bool kullanildi;
    }

    mapping(address => Talep) public qrTalepleri;

    constructor(address _tokenAdresi) {
        belediye = msg.sender;
        tokenKontrati = IBelediyeToken(_tokenAdresi);
    }

    // Vatandaş QR kod oluşturmak için talep açar
    function qrKodOlustur() external {
        qrTalepleri[msg.sender] = Talep(block.timestamp, false);
    }

    // Geri dönüşüm noktasında QR okutulduğunda belediye onaylar
    function atikTeslimAl(address _vatandas, uint256 _miktar) external {
        require(msg.sender == belediye, "Yetkisiz islem.");
        require(!qrTalepleri[_vatandas].kullanildi, "QR kod zaten kullanilmis.");
        require(block.timestamp <= qrTalepleri[_vatandas].olusturulmaZamani + 3 hours, "QR suresi dolmus.");

        qrTalepleri[_vatandas].kullanildi = true;
        
        // Vatandaşa geri dönüşüm miktarının 10 katı token verilir
        tokenKontrati.odulVer(_vatandas, _miktar * 10);
    }
}