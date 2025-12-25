// SPDX-License-Identifier: MIT pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BelediyeToken is ERC20 { address public admin;

```

constructor() ERC20("Belediye Token", "BTK") {

    admin = msg.sender;

}

function odulVer(address vatandas, uint256 miktar) external {

    require(msg.sender == admin, "Sadece belediye yetkilisi.");

    _mint(vatandas, miktar);

}

```

}