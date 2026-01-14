const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Fraud Penalties", function () {
    let beltToken, ecoCivicDeposit, waterBilling, fraudManager;
    let owner, user1, user2, inspector, fraudDetector;
    let mockUSDC, mockLendingPool;

    beforeEach(async function () {
        [owner, user1, user2, inspector, fraudDetector] = await ethers.getSigners();

        // Deploy Mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");

        const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
        mockLendingPool = await MockLendingPool.deploy();

        // Deploy BELT Token
        const BELTToken = await ethers.getContractFactory("BELTToken");
        beltToken = await BELTToken.deploy();

        // Deploy EcoCivicDeposit
        const EcoCivicDeposit = await ethers.getContractFactory("EcoCivicDeposit");
        ecoCivicDeposit = await EcoCivicDeposit.deploy(
            await mockUSDC.getAddress(),
            await mockLendingPool.getAddress()
        );

        // Deploy WaterBilling
        const WaterBilling = await ethers.getContractFactory("WaterBilling");
        waterBilling = await WaterBilling.deploy(await beltToken.getAddress());

        // Deploy FraudManager
        const WaterBillingFraudManager = await ethers.getContractFactory("WaterBillingFraudManager");
        fraudManager = await WaterBillingFraudManager.deploy(await ecoCivicDeposit.getAddress());

        // Grant roles
        const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
        await beltToken.grantRole(MINTER_ROLE, await waterBilling.getAddress());

        const FRAUD_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE"));
        await waterBilling.grantRole(FRAUD_MANAGER_ROLE, await fraudManager.getAddress());

        const FRAUD_DETECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FRAUD_DETECTOR_ROLE"));
        await fraudManager.grantRole(FRAUD_DETECTOR_ROLE, fraudDetector.address);

        const INSPECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR_ROLE"));
        await fraudManager.grantRole(INSPECTOR_ROLE, inspector.address);
    });

    describe("AI Fraud Penalty", function () {
        it("Should penalize 50% deposit for AI-detected fraud", async function () {
            // Setup: User has deposit
            const depositAmount = ethers.parseEther("1000");

            // Mock user deposit (simplified - real impl uses EcoCivicDeposit)
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            const initialDeposit = await waterBilling.userDeposits(user1.address);
            expect(initialDeposit).to.equal(depositAmount);

            // Report fraud
            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await waterBilling.reportFraud(user1.address, "OCR anomaly detected");

            // Check penalty applied (50%)
            const finalDeposit = await waterBilling.userDeposits(user1.address);
            expect(finalDeposit).to.equal(depositAmount / 2n);
        });

        it("Should emit FraudPenaltyApplied event", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await expect(waterBilling.reportFraud(user1.address, "Test fraud"))
                .to.emit(waterBilling, "FraudPenaltyApplied")
                .withArgs(user1.address, depositAmount / 2n, "Test fraud");
        });

        it("Should set user status to UnderReview after fraud report", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await waterBilling.reportFraud(user1.address, "Test fraud");

            const status = await waterBilling.userStatus(user1.address);
            expect(status).to.equal(2); // UnderReview = 2
        });
    });

    describe("Inspection Fraud Penalty", function () {
        it("Should penalize 100% deposit for inspection-confirmed fraud", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            // Reported: 100, Actual: 200 (fraud)
            await waterBilling.periodicInspectionResult(
                user1.address,
                true,   // fraudFound
                200,    // actualReading
                100     // reportedReading
            );

            const finalDeposit = await waterBilling.userDeposits(user1.address);
            expect(finalDeposit).to.equal(0n);
        });

        it("Should emit PeriodicInspectionResult event", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await expect(waterBilling.periodicInspectionResult(user1.address, true, 200, 100))
                .to.emit(waterBilling, "PeriodicInspectionResult")
                .withArgs(user1.address, true, depositAmount);
        });

        it("Should suspend user after inspection fraud", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await waterBilling.periodicInspectionResult(user1.address, true, 200, 100);

            const status = await waterBilling.userStatus(user1.address);
            expect(status).to.equal(3); // Suspended = 3
        });

        it("Should restore active status if no fraud found", async function () {
            // First set to UnderReview
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await waterBilling.connect(owner).grantRole(
                ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE")),
                owner.address
            );

            await waterBilling.reportFraud(user1.address, "Suspected fraud");
            expect(await waterBilling.userStatus(user1.address)).to.equal(2); // UnderReview

            // Then complete inspection with no fraud
            await waterBilling.periodicInspectionResult(user1.address, false, 100, 100);

            const status = await waterBilling.userStatus(user1.address);
            expect(status).to.equal(0); // Active = 0
        });
    });

    describe("Interest Calculation", function () {
        it("Should calculate interest correctly", async function () {
            const amount = ethers.parseEther("100");
            const monthsLate = 3n;

            // 5% monthly interest
            const interest = await waterBilling.calculateInterest(amount, monthsLate);

            // 100 * 5% * 3 = 15
            expect(interest).to.equal(ethers.parseEther("15"));
        });

        it("Should return 0 interest for 0 amount", async function () {
            const interest = await waterBilling.calculateInterest(0, 3);
            expect(interest).to.equal(0);
        });

        it("Should return 0 interest for 0 months", async function () {
            const interest = await waterBilling.calculateInterest(ethers.parseEther("100"), 0);
            expect(interest).to.equal(0);
        });
    });

    describe("Penalty Calculation", function () {
        it("Should calculate 50% penalty correctly", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            const penalty = await waterBilling.calculatePenalty(user1.address, 50);
            expect(penalty).to.equal(ethers.parseEther("500"));
        });

        it("Should calculate 100% penalty correctly", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            const penalty = await waterBilling.calculatePenalty(user1.address, 100);
            expect(penalty).to.equal(ethers.parseEther("1000"));
        });

        it("Should revert for penalty > 100%", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await expect(waterBilling.calculatePenalty(user1.address, 101))
                .to.be.revertedWith("Penalty cannot exceed 100%");
        });
    });

    describe("Access Control", function () {
        it("Should only allow FRAUD_MANAGER_ROLE to report fraud", async function () {
            const depositAmount = ethers.parseEther("1000");
            await waterBilling.setUserDeposit(user1.address, depositAmount);

            await expect(
                waterBilling.connect(user2).reportFraud(user1.address, "Unauthorized")
            ).to.be.reverted;
        });

        it("Should only allow FRAUD_MANAGER_ROLE to complete inspection", async function () {
            await expect(
                waterBilling.connect(user2).periodicInspectionResult(user1.address, true, 200, 100)
            ).to.be.reverted;
        });
    });
});
