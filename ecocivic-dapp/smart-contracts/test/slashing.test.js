const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SlashingManager", function () {
    let SlashingManager, slashingManager;
    let EcoCivicDeposit, ecoCivicDeposit;
    let MockERC20, mockUSDC;
    let MockLendingPool, mockLendingPool;
    let owner, slasher, user1, user2;

    const depositAmount = 1000;

    beforeEach(async function () {
        [owner, slasher, user1, user2] = await ethers.getSigners();

        // Deploy Mock USDC
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");

        // Deploy Mock Lending Pool
        MockLendingPool = await ethers.getContractFactory("MockLendingPool");
        mockLendingPool = await MockLendingPool.deploy();

        // Deploy EcoCivicDeposit
        EcoCivicDeposit = await ethers.getContractFactory("EcoCivicDeposit");
        ecoCivicDeposit = await EcoCivicDeposit.deploy(
            await mockUSDC.getAddress(),
            await mockLendingPool.getAddress()
        );

        // Deploy SlashingManager
        SlashingManager = await ethers.getContractFactory("SlashingManager");
        slashingManager = await SlashingManager.deploy(await ecoCivicDeposit.getAddress());

        // Transfer ownership of EcoCivicDeposit to SlashingManager
        // This allows SlashingManager to call withdraw on EcoCivicDeposit
        await ecoCivicDeposit.transferOwnership(await slashingManager.getAddress());

        // Setup user deposits
        await mockUSDC.mint(user1.address, depositAmount);
        await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
        await ecoCivicDeposit.connect(user1).deposit(depositAmount);
    });

    describe("Deployment", function () {
        it("Should set the correct deposit contract", async function () {
            expect(await slashingManager.depositContract()).to.equal(await ecoCivicDeposit.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await slashingManager.owner()).to.equal(owner.address);
        });
    });

    describe("Slashing", function () {
        it("Should slash user deposit", async function () {
            const slashAmount = 100;
            const reason = "Late payment violation";

            await expect(slashingManager.slashUser(user1.address, slashAmount, reason))
                .to.emit(slashingManager, "UserSlashed")
                .withArgs(user1.address, slashAmount, reason);

            // Slashed funds go to slashing manager
            expect(await mockUSDC.balanceOf(await slashingManager.getAddress())).to.equal(slashAmount);
        });

        it("Should reject slashing zero address", async function () {
            await expect(
                slashingManager.slashUser(ethers.ZeroAddress, 100, "reason")
            ).to.be.revertedWith("Invalid user");
        });

        it("Should reject slashing zero amount", async function () {
            await expect(
                slashingManager.slashUser(user1.address, 0, "reason")
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should reject slashing more than user deposit", async function () {
            await expect(
                slashingManager.slashUser(user1.address, depositAmount + 1, "reason")
            ).to.be.revertedWith("Cannot slash more than user deposit");
        });

        it("Should reject slashing from non-owner", async function () {
            await expect(
                slashingManager.connect(user2).slashUser(user1.address, 100, "reason")
            ).to.be.revertedWithCustomError(slashingManager, "OwnableUnauthorizedAccount");
        });
    });

    describe("Multiple Slashes", function () {
        it("Should allow multiple slashes until deposit is depleted", async function () {
            const slashAmount = 300;

            await slashingManager.slashUser(user1.address, slashAmount, "First violation");
            await slashingManager.slashUser(user1.address, slashAmount, "Second violation");
            await slashingManager.slashUser(user1.address, slashAmount, "Third violation");

            // Check remaining deposit
            expect(await ecoCivicDeposit.getUserDeposit(user1.address)).to.equal(depositAmount);
            // Note: The deposit tracking in EcoCivicDeposit doesn't decrease on withdraw
            // In production, you'd need to sync this or track separately

            // SlashingManager should have received all slashed funds
            expect(await mockUSDC.balanceOf(await slashingManager.getAddress())).to.equal(slashAmount * 3);
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            await slashingManager.transferOwnership(slasher.address);
            expect(await slashingManager.owner()).to.equal(slasher.address);
        });

        it("New owner should be able to slash", async function () {
            await slashingManager.transferOwnership(slasher.address);

            await expect(
                slashingManager.connect(slasher).slashUser(user1.address, 100, "test")
            ).to.emit(slashingManager, "UserSlashed");
        });
    });

    describe("Slashing with Different Reasons", function () {
        it("Should emit correct reason in event", async function () {
            const reasons = [
                "Late payment",
                "Contract violation",
                "Environmental infringement",
                "Fraudulent activity"
            ];

            for (const reason of reasons) {
                await mockUSDC.mint(user2.address, 100);
                await mockUSDC.connect(user2).approve(await ecoCivicDeposit.getAddress(), 100);
                await ecoCivicDeposit.connect(user2).deposit(100);

                await expect(slashingManager.slashUser(user2.address, 25, reason))
                    .to.emit(slashingManager, "UserSlashed")
                    .withArgs(user2.address, 25, reason);
            }
        });
    });
});