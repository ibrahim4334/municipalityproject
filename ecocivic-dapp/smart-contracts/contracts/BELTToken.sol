// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract BELTToken is ERC20, AccessControl {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion BELT max
    bool public paused;

    event Paused(address account);
    event Unpaused(address account);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    modifier whenNotPaused() {
        require(!paused, "Token operations are paused");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }

    constructor() ERC20("Belediye Eco Token", "BELT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(SLASHER_ROLE, msg.sender);
    }

    /**
     * @notice Sadece MINTER_ROLE yetkisi olanlar (örn. RecyclingRewards kontratı) basabilir
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused
        validAddress(to)
    {
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Minting would exceed max supply");
        
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Token yakma fonksiyonu
     */
    function burn(uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }

    /**
     * @notice SLASHER_ROLE tarafından token yakma (slashing için)
     */
    function burnFrom(address account, uint256 amount) 
        external 
        onlyRole(SLASHER_ROLE)
        whenNotPaused
        validAddress(account)
    {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(account) >= amount, "Insufficient balance");
        
        _burn(account, amount);
        emit Burned(account, amount);
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
     * @notice Transfer override - pause kontrolü ekle
     */
    function transfer(address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        validAddress(to)
        returns (bool) 
    {
        return super.transfer(to, amount);
    }

    /**
     * @notice TransferFrom override - pause kontrolü ekle
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        validAddress(from)
        validAddress(to)
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }
}
