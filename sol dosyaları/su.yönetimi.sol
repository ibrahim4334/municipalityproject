// SPDX-License-Identifier: MIT pragma solidity ^0.8.0;

contract SuYonetimi { address public belediye; uint256 public constant DEPOZITO_MIKTARI = 0.1 ether;

```

struct Fatura {

    uint256 endeks;

    bool onaylandi;

    bool cezaUygulandi;

}

mapping(address => uint256) public depozitolar;

mapping(address => Fatura) public sonFaturalar;

constructor() {

    belediye = msg.sender;

}

function depozitoYatir() external payable {

    require(msg.value == DEPOZITO_MIKTARI, "Hatali depozito.");

    depozitolar[msg.sender] = msg.value;

}

function faturaBildir(uint256 _endeks) external {

    require(depozitolar[msg.sender] > 0, "Depozito yok.");

    sonFaturalar[msg.sender] = Fatura(_endeks, false, false);

}

function aiOnayla(address vatandas, bool dogruMu) external {

    require(msg.sender == belediye, "Yetkisiz.");

    if(dogruMu) {

        sonFaturalar[vatandas].onaylandi = true;

    } else {

        depozitolar[vatandas] = 0; // Slashing (Depozitoya el koyma)

        sonFaturalar[vatandas].cezaUygulandi = true;

    }

}

```

}