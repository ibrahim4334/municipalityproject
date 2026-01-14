const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Physical Inspection", function () {
    let beltToken, ecoCivicDeposit, fraudManager;
    let owner, user1, inspector1, inspector2;
    let mockUSDC, mockLendingPool;

    beforeEach(async function () {
        [owner, user1, inspector1, inspector2] = await ethers.getSigners();

        // Deploy Mock contracts
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");

        const MockLendingPool = await ethers.getContractFactory("MockLendingPool");
        mockLendingPool = await MockLendingPool.deploy();

        // Deploy EcoCivicDeposit
        const EcoCivicDeposit = await ethers.getContractFactory("EcoCivicDeposit");
        ecoCivicDeposit = await EcoCivicDeposit.deploy(
            await mockUSDC.getAddress(),
            await mockLendingPool.getAddress()
        );

        // Deploy FraudManager
        const WaterBillingFraudManager = await ethers.getContractFactory("WaterBillingFraudManager");
        fraudManager = await WaterBillingFraudManager.deploy(await ecoCivicDeposit.getAddress());
    });

    describe("Inspector Whitelist", function () {
        it("Should add inspector to whitelist", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);

            expect(await fraudManager.isInspectorAuthorized(inspector1.address)).to.be.true;
            expect(await fraudManager.getInspectorCount()).to.equal(1);
        });

        it("Should emit InspectorAdded event", async function () {
            await expect(fraudManager.addInspectorToWhitelist(inspector1.address))
                .to.emit(fraudManager, "InspectorAdded")
                .withArgs(inspector1.address);
        });

        it("Should remove inspector from whitelist", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
            await fraudManager.removeInspectorFromWhitelist(inspector1.address);

            expect(await fraudManager.isInspectorAuthorized(inspector1.address)).to.be.false;
            expect(await fraudManager.getInspectorCount()).to.equal(0);
        });

        it("Should emit InspectorRemoved event", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);

            await expect(fraudManager.removeInspectorFromWhitelist(inspector1.address))
                .to.emit(fraudManager, "InspectorRemoved")
                .withArgs(inspector1.address);
        });

        it("Should grant INSPECTOR_ROLE when adding to whitelist", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);

            const INSPECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR_ROLE"));
            expect(await fraudManager.hasRole(INSPECTOR_ROLE, inspector1.address)).to.be.true;
        });

        it("Should revoke INSPECTOR_ROLE when removing from whitelist", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
            await fraudManager.removeInspectorFromWhitelist(inspector1.address);

            const INSPECTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("INSPECTOR_ROLE"));
            expect(await fraudManager.hasRole(INSPECTOR_ROLE, inspector1.address)).to.be.false;
        });

        it("Should return all inspectors in list", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
            await fraudManager.addInspectorToWhitelist(inspector2.address);

            const list = await fraudManager.getInspectorList();
            expect(list.length).to.equal(2);
            expect(list).to.include(inspector1.address);
            expect(list).to.include(inspector2.address);
        });

        it("Should not allow duplicate whitelist entries", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);

            await expect(fraudManager.addInspectorToWhitelist(inspector1.address))
                .to.be.revertedWith("Already in whitelist");
        });

        it("Should only allow admin to add inspector", async function () {
            await expect(
                fraudManager.connect(user1).addInspectorToWhitelist(inspector1.address)
            ).to.be.reverted;
        });
    });

    describe("Inspection Scheduling", function () {
        beforeEach(async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
        });

        it("Should schedule inspection", async function () {
            await fraudManager.connect(inspector1).scheduleInspection(user1.address);

            const inspection = await fraudManager.inspections(1);
            expect(inspection.user).to.equal(user1.address);
            expect(inspection.completed).to.be.false;
        });

        it("Should emit InspectionScheduled event", async function () {
            await expect(fraudManager.connect(inspector1).scheduleInspection(user1.address))
                .to.emit(fraudManager, "InspectionScheduled");
        });

        it("Should update user fraud status to InspectionPending", async function () {
            await fraudManager.connect(inspector1).scheduleInspection(user1.address);

            const fraudData = await fraudManager.getUserFraudStatus(user1.address);
            expect(fraudData.status).to.equal(3); // InspectionPending = 3
        });
    });

    describe("Inspection Completion", function () {
        beforeEach(async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
            await fraudManager.connect(inspector1).scheduleInspection(user1.address);
        });

        it("Should complete inspection without fraud", async function () {
            await fraudManager.connect(inspector1).completeInspection(
                1,      // inspectionId
                100,    // actualReading
                100,    // reportedReading
                false,  // fraudFound
                "Normal inspection"
            );

            const inspection = await fraudManager.inspections(1);
            expect(inspection.completed).to.be.true;
            expect(inspection.fraudFound).to.be.false;
        });

        it("Should complete inspection with fraud", async function () {
            await fraudManager.connect(inspector1).completeInspection(
                1,
                200,
                100,
                true,
                "Meter reading discrepancy"
            );

            const inspection = await fraudManager.inspections(1);
            expect(inspection.completed).to.be.true;
            expect(inspection.fraudFound).to.be.true;
        });

        it("Should emit InspectionCompleted event", async function () {
            await expect(
                fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "OK")
            )
                .to.emit(fraudManager, "InspectionCompleted")
                .withArgs(1, user1.address, false, inspector1.address);
        });

        it("Should record inspector address", async function () {
            await fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "OK");

            const inspection = await fraudManager.inspections(1);
            expect(inspection.inspector).to.equal(inspector1.address);
        });

        it("Should not allow completing already completed inspection", async function () {
            await fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "OK");

            await expect(
                fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "Again")
            ).to.be.revertedWith("Already completed");
        });

        it("Should reset status to None if no fraud found", async function () {
            await fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "OK");

            const fraudData = await fraudManager.getUserFraudStatus(user1.address);
            expect(fraudData.status).to.equal(0); // None = 0
        });
    });

    describe("Inspection Due Check", function () {
        it("Should return true if never inspected", async function () {
            expect(await fraudManager.isInspectionDue(user1.address)).to.be.true;
        });

        it("Should return false immediately after inspection", async function () {
            await fraudManager.addInspectorToWhitelist(inspector1.address);
            await fraudManager.connect(inspector1).scheduleInspection(user1.address);
            await fraudManager.connect(inspector1).completeInspection(1, 100, 100, false, "OK");

            expect(await fraudManager.isInspectionDue(user1.address)).to.be.false;
        });
    });
});
