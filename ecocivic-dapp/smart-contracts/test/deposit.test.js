const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EcoCivicDeposit", function () {
    let EcoCivicDeposit, ecoCivicDeposit;
    let MockERC20, mockUSDC;
    let MockLendingPool, mockLendingPool;
    let owner, user1, user2;

    const depositAmount = 1000; // 1000 USDC (assuming 6 decimals, but mock uses 18)

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

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

        // Mint USDC to users
        await mockUSDC.mint(user1.address, depositAmount * 10);
        await mockUSDC.mint(user2.address, depositAmount * 10);
    });

    describe("Deployment", function () {
        it("Should set the correct deposit token", async function () {
            expect(await ecoCivicDeposit.depositToken()).to.equal(await mockUSDC.getAddress());
        });

        it("Should set the correct lending pool", async function () {
            expect(await ecoCivicDeposit.aaveLendingPool()).to.equal(await mockLendingPool.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await ecoCivicDeposit.owner()).to.equal(owner.address);
        });

        it("Should not be paused initially", async function () {
            expect(await ecoCivicDeposit.paused()).to.be.false;
        });

        it("Should revert with zero deposit token address", async function () {
            await expect(
                EcoCivicDeposit.deploy(ethers.ZeroAddress, await mockLendingPool.getAddress())
            ).to.be.revertedWith("Invalid deposit token address");
        });

        it("Should revert with zero lending pool address", async function () {
            await expect(
                EcoCivicDeposit.deploy(await mockUSDC.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid Aave lending pool address");
        });
    });

    describe("Deposit", function () {
        beforeEach(async function () {
            // Approve deposit contract
            await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
        });

        it("Should accept deposits and track user balance", async function () {
            await expect(ecoCivicDeposit.connect(user1).deposit(depositAmount))
                .to.emit(ecoCivicDeposit, "Deposited")
                .withArgs(user1.address, depositAmount);

            expect(await ecoCivicDeposit.getUserDeposit(user1.address)).to.equal(depositAmount);
        });

        it("Should transfer tokens to lending pool", async function () {
            await ecoCivicDeposit.connect(user1).deposit(depositAmount);

            // Check mock lending pool received the tokens
            const poolBalance = await mockLendingPool.deposits(
                await mockUSDC.getAddress(),
                await ecoCivicDeposit.getAddress()
            );
            expect(poolBalance).to.equal(depositAmount);
        });

        it("Should accumulate multiple deposits", async function () {
            await ecoCivicDeposit.connect(user1).deposit(depositAmount);

            await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
            await ecoCivicDeposit.connect(user1).deposit(depositAmount);

            expect(await ecoCivicDeposit.getUserDeposit(user1.address)).to.equal(depositAmount * 2);
        });

        it("Should reject zero deposit", async function () {
            await expect(
                ecoCivicDeposit.connect(user1).deposit(0)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should reject deposit when paused", async function () {
            await ecoCivicDeposit.pause();

            await expect(
                ecoCivicDeposit.connect(user1).deposit(depositAmount)
            ).to.be.revertedWith("Contract is paused");
        });
    });

    describe("Withdraw", function () {
        beforeEach(async function () {
            await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
            await ecoCivicDeposit.connect(user1).deposit(depositAmount);
        });

        it("Should allow owner to withdraw", async function () {
            await expect(ecoCivicDeposit.connect(owner).withdraw(depositAmount, owner.address))
                .to.emit(ecoCivicDeposit, "Withdrawn")
                .withArgs(owner.address, depositAmount);

            expect(await mockUSDC.balanceOf(owner.address)).to.equal(depositAmount);
        });

        it("Should reject withdrawal from non-owner", async function () {
            await expect(
                ecoCivicDeposit.connect(user1).withdraw(depositAmount, user1.address)
            ).to.be.revertedWithCustomError(ecoCivicDeposit, "OwnableUnauthorizedAccount");
        });

        it("Should reject zero withdrawal", async function () {
            await expect(
                ecoCivicDeposit.connect(owner).withdraw(0, owner.address)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should reject withdrawal to zero address", async function () {
            await expect(
                ecoCivicDeposit.connect(owner).withdraw(depositAmount, ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid address");
        });
    });

    describe("Pause/Unpause", function () {
        it("Should allow owner to pause", async function () {
            await expect(ecoCivicDeposit.pause())
                .to.emit(ecoCivicDeposit, "Paused")
                .withArgs(owner.address);

            expect(await ecoCivicDeposit.paused()).to.be.true;
        });

        it("Should allow owner to unpause", async function () {
            await ecoCivicDeposit.pause();

            await expect(ecoCivicDeposit.unpause())
                .to.emit(ecoCivicDeposit, "Unpaused")
                .withArgs(owner.address);

            expect(await ecoCivicDeposit.paused()).to.be.false;
        });

        it("Should reject pause from non-owner", async function () {
            await expect(
                ecoCivicDeposit.connect(user1).pause()
            ).to.be.revertedWithCustomError(ecoCivicDeposit, "OwnableUnauthorizedAccount");
        });

        it("Should reject pausing when already paused", async function () {
            await ecoCivicDeposit.pause();
            await expect(ecoCivicDeposit.pause()).to.be.revertedWith("Already paused");
        });

        it("Should reject unpausing when not paused", async function () {
            await expect(ecoCivicDeposit.unpause()).to.be.revertedWith("Not paused");
        });
    });

    describe("Emergency Withdraw", function () {
        beforeEach(async function () {
            await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
            await ecoCivicDeposit.connect(user1).deposit(depositAmount);
        });

        it("Should allow emergency withdraw when paused", async function () {
            await ecoCivicDeposit.pause();

            // Transfer some tokens directly to contract (simulating stuck funds)
            await mockUSDC.mint(await ecoCivicDeposit.getAddress(), 500);

            await expect(ecoCivicDeposit.emergencyWithdraw(owner.address, 500))
                .to.emit(ecoCivicDeposit, "Withdrawn")
                .withArgs(owner.address, 500);
        });

        it("Should reject emergency withdraw when not paused", async function () {
            await expect(
                ecoCivicDeposit.emergencyWithdraw(owner.address, 100)
            ).to.be.revertedWith("Not in emergency state");
        });
    });

    describe("Multiple Users", function () {
        it("Should track deposits independently for each user", async function () {
            await mockUSDC.connect(user1).approve(await ecoCivicDeposit.getAddress(), depositAmount);
            await mockUSDC.connect(user2).approve(await ecoCivicDeposit.getAddress(), depositAmount * 2);

            await ecoCivicDeposit.connect(user1).deposit(depositAmount);
            await ecoCivicDeposit.connect(user2).deposit(depositAmount * 2);

            expect(await ecoCivicDeposit.getUserDeposit(user1.address)).to.equal(depositAmount);
            expect(await ecoCivicDeposit.getUserDeposit(user2.address)).to.equal(depositAmount * 2);
        });
    });
});