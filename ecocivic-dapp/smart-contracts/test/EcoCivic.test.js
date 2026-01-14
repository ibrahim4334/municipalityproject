const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcoCivic System", function () {
    let BELTToken, beltToken;
    let RecyclingRewards, recyclingRewards;
    let EcoCivicDeposit, ecoCivicDeposit;
    let MockERC20, mockUSDC;
    let MockLendingPool, mockLendingPool;
    let owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        // 1. Setup Tokens & Rewards
        BELTToken = await ethers.getContractFactory("BELTToken");
        beltToken = await BELTToken.deploy();

        RecyclingRewards = await ethers.getContractFactory("RecyclingRewards");
        recyclingRewards = await RecyclingRewards.deploy(await beltToken.getAddress());

        // Grant MINTER_ROLE to RecyclingRewards so it can mint BELT tokens
        const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
        await beltToken.grantRole(MINTER_ROLE, await recyclingRewards.getAddress());

        // 2. Setup Mocks
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");

        MockLendingPool = await ethers.getContractFactory("MockLendingPool");
        mockLendingPool = await MockLendingPool.deploy();

        // 3. Setup Deposit Contract
        EcoCivicDeposit = await ethers.getContractFactory("EcoCivicDeposit");
        ecoCivicDeposit = await EcoCivicDeposit.deploy(await mockUSDC.getAddress(), await mockLendingPool.getAddress());
    });

    describe("Recycling Rewards", function () {
        it("Should mint BELT tokens for valid recycling", async function () {
            const materialType = 0; // Glass
            const baseAmount = 100;
            const qrHash = "dummy_hash";

            await expect(recyclingRewards.rewardRecycling(addr1.address, materialType, baseAmount, qrHash))
                .to.emit(recyclingRewards, "RewardGranted")
                .withArgs(addr1.address, materialType, 100, qrHash);

            expect(await beltToken.balanceOf(addr1.address)).to.equal(100);
        });

        it("Should reject non-operator calls", async function () {
            await expect(
                recyclingRewards.connect(addr1).rewardRecycling(addr1.address, 0, 100, "hash")
            ).to.be.revertedWithCustomError(recyclingRewards, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Deposits", function () {
        it("Should deposit tokens into Aave via EcoCivicDeposit", async function () {
            const depositAmount = 1000; // Using integer for simplicity

            // 1. Mint Mock USDC to user
            await mockUSDC.mint(addr1.address, depositAmount);

            // 2. Approve EcoCivicDeposit to spend user's USDC
            await mockUSDC.connect(addr1).approve(await ecoCivicDeposit.getAddress(), depositAmount);

            // 3. Call deposit
            await expect(ecoCivicDeposit.connect(addr1).deposit(depositAmount))
                .to.emit(ecoCivicDeposit, "Deposited")
                .withArgs(addr1.address, depositAmount);

            // 4. Verify user deposit tracking in EcoCivic
            expect(await ecoCivicDeposit.getUserDeposit(addr1.address)).to.equal(depositAmount);

            // 5. Verify funds moved to MockLendingPool
            // MockLendingPool has a mapping: deposits[asset][onBehalfOf]
            // The contract deposits on behalf of itself (address(this))
            const poolBalance = await mockLendingPool.deposits(await mockUSDC.getAddress(), await ecoCivicDeposit.getAddress());
            expect(poolBalance).to.equal(depositAmount);

            // Also check that MockLendingPool actually holds the tokens
            expect(await mockUSDC.balanceOf(await mockLendingPool.getAddress())).to.equal(depositAmount);
        });

        it("Should withdraw tokens from Aave", async function () {
            const depositAmount = 1000;
            await mockUSDC.mint(addr1.address, depositAmount);
            await mockUSDC.connect(addr1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
            await ecoCivicDeposit.connect(addr1).deposit(depositAmount);

            // Owner withdraws
            await expect(ecoCivicDeposit.connect(owner).withdraw(depositAmount, owner.address))
                .to.emit(ecoCivicDeposit, "Withdrawn")
                .withArgs(owner.address, depositAmount);

            // Check owner balance (funds start at mock -> pool -> withdrawn to owner)
            expect(await mockUSDC.balanceOf(owner.address)).to.equal(depositAmount);

            // Check pool balance decreased
            const poolBalance = await mockLendingPool.deposits(await mockUSDC.getAddress(), await ecoCivicDeposit.getAddress());
            expect(poolBalance).to.equal(0);
        });
    });
});
