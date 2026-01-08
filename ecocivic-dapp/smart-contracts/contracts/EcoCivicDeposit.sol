// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAave.sol";

contract EcoCivicDeposit is Ownable, ReentrancyGuard {

    IERC20 public immutable depositToken;   // Örn: USDC
    IAave public immutable aaveLendingPool;

    mapping(address => uint256) public userDeposits;
    bool public paused;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event Paused(address account);
    event Unpaused(address account);

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }

    constructor(
        address _depositToken,
        address _aaveLendingPool
    ) Ownable(msg.sender) {
        require(_depositToken != address(0), "Invalid deposit token address");
        require(_aaveLendingPool != address(0), "Invalid Aave lending pool address");
        
        depositToken = IERC20(_depositToken);
        aaveLendingPool = IAave(_aaveLendingPool);
    }

    /**
     * @notice Vatandaş depozito yatırır
     */
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(msg.sender != address(0), "Invalid sender");

        // Kullanıcıdan token al - transferFrom başarısız olursa revert eder
        bool success = depositToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");

        // Aave'ye onay ver
        depositToken.approve(address(aaveLendingPool), amount);

        // Aave'ye yatır
        aaveLendingPool.deposit(
            address(depositToken),
            amount,
            address(this),
            0
        );

        userDeposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Belediyenin Aave'den fon çekmesi
     * (Slashing, iade veya sistem yönetimi için)
     */
    function withdraw(uint256 amount, address to) 
        external 
        onlyOwner 
        validAddress(to)
        nonReentrant 
    {
        require(amount > 0, "Amount must be > 0");

        uint256 withdrawn = aaveLendingPool.withdraw(
            address(depositToken),
            amount,
            address(this)
        );

        require(withdrawn > 0, "Withdrawal failed");

        bool success = depositToken.transfer(to, withdrawn);
        require(success, "Token transfer to recipient failed");

        emit Withdrawn(to, withdrawn);
    }

    /**
     * @notice Kullanıcının yatırdığı toplam depozito
     */
    function getUserDeposit(address user) external view returns (uint256) {
        return userDeposits[user];
    }

    /**
     * @notice Contract'ı durdur (acil durumlar için)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Contract'ı devam ettir
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Emergency withdraw - sadece owner, pause durumunda
     */
    function emergencyWithdraw(address to, uint256 amount) 
        external 
        onlyOwner 
        validAddress(to)
        nonReentrant 
    {
        require(paused, "Not in emergency state");
        require(amount > 0, "Amount must be > 0");

        bool success = depositToken.transfer(to, amount);
        require(success, "Emergency withdrawal failed");

        emit Withdrawn(to, amount);
    }
}
