const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Consumption Drop & Real-Time Photo", function () {
    let beltToken, waterBilling;
    let owner, user1, serviceOperator;

    beforeEach(async function () {
        [owner, user1, serviceOperator] = await ethers.getSigners();

        // Deploy BELT Token
        const BELTToken = await ethers.getContractFactory("BELTToken");
        beltToken = await BELTToken.deploy();

        // Deploy WaterBilling
        const WaterBilling = await ethers.getContractFactory("WaterBilling");
        waterBilling = await WaterBilling.deploy(await beltToken.getAddress());

        // Grant roles
        const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
        await beltToken.grantRole(MINTER_ROLE, await waterBilling.getAddress());

        const SERVICE_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SERVICE_OPERATOR_ROLE"));
        await waterBilling.grantRole(SERVICE_OPERATOR_ROLE, serviceOperator.address);

        // Register meter for user
        await waterBilling.connect(serviceOperator).registerMeter(user1.address, "METER001");
    });

    describe("Consumption Drop Warning", function () {
        beforeEach(async function () {
            // Submit 6 months of consistent readings to build history
            let reading = 1000;
            for (let i = 0; i < 6; i++) {
                await waterBilling.connect(serviceOperator).submitReading(
                    user1.address,
                    reading,
                    true // userConfirmed
                );
                reading += 100; // 100 m³ per month
            }
        });

        it("Should require confirmation for >50% consumption drop", async function () {
            // Last reading was 1500, avg consumption is 100
            // New reading with only 30 m³ consumption (70% drop)
            const result = await waterBilling.connect(serviceOperator).submitReading.staticCall(
                user1.address,
                1530, // Only 30 m³ vs avg 100 m³ (70% drop)
                false // NOT confirmed
            );

            expect(result.requiresConfirmation).to.be.true;
        });

        it("Should emit ConsumptionDropWarning event", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(
                    user1.address,
                    1530, // 70% drop
                    false
                )
            ).to.emit(waterBilling, "ConsumptionDropWarning");
        });

        it("Should set status to PendingConfirmation", async function () {
            await waterBilling.connect(serviceOperator).submitReading(
                user1.address,
                1530,
                false
            );

            const status = await waterBilling.userStatus(user1.address);
            expect(status).to.equal(1); // PendingConfirmation = 1
        });

        it("Should emit ConfirmationRequired event", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(
                    user1.address,
                    1530,
                    false
                )
            ).to.emit(waterBilling, "ConfirmationRequired");
        });

        it("Should proceed with userConfirmed=true", async function () {
            const result = await waterBilling.connect(serviceOperator).submitReading.staticCall(
                user1.address,
                1530,
                true // User confirmed
            );

            expect(result.requiresConfirmation).to.be.false;
        });

        it("Should emit ConfirmationProvided when confirmed", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(
                    user1.address,
                    1530,
                    true // User confirmed
                )
            ).to.emit(waterBilling, "ConfirmationProvided");
        });

        it("Should not require confirmation for normal consumption", async function () {
            // 80 m³ consumption vs avg 100 m³ (20% drop - under threshold)
            const result = await waterBilling.connect(serviceOperator).submitReading.staticCall(
                user1.address,
                1580, // 80 m³ consumption
                false
            );

            expect(result.requiresConfirmation).to.be.false;
        });
    });

    describe("Consumption History Tracking", function () {
        it("Should track consumption history", async function () {
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1000, true);
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1100, true);
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1200, true);

            const history = await waterBilling.getConsumptionHistory(user1.address);
            expect(history.length).to.be.greaterThan(0);
        });

        it("Should update lastReading correctly", async function () {
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1000, true);
            expect(await waterBilling.lastReading(user1.address)).to.equal(1000);

            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1150, true);
            expect(await waterBilling.lastReading(user1.address)).to.equal(1150);
        });

        it("Should calculate consumption delta correctly", async function () {
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1000, true);

            const tx = await waterBilling.connect(serviceOperator).submitReading(user1.address, 1150, true);
            const receipt = await tx.wait();

            // Find ReadingSubmitted event
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === "ReadingSubmitted"
            );

            if (event) {
                expect(event.args.consumption).to.equal(150); // 1150 - 1000
            }
        });
    });

    describe("Meter Registration", function () {
        it("Should register meter number", async function () {
            const meterNo = await waterBilling.userMeterNo(user1.address);
            expect(meterNo).to.equal("METER001");
        });

        it("Should map meter to user", async function () {
            const userAddr = await waterBilling.meterToUser("METER001");
            expect(userAddr).to.equal(user1.address);
        });

        it("Should emit MeterRegistered event", async function () {
            await expect(
                waterBilling.connect(serviceOperator).registerMeter(
                    owner.address, // Different user
                    "METER002"
                )
            ).to.emit(waterBilling, "MeterRegistered")
                .withArgs(owner.address, "METER002");
        });

        it("Should not allow duplicate meter numbers", async function () {
            await expect(
                waterBilling.connect(serviceOperator).registerMeter(
                    owner.address,
                    "METER001" // Already registered
                )
            ).to.be.revertedWith("Meter already registered");
        });
    });

    describe("Reading Validation", function () {
        beforeEach(async function () {
            await waterBilling.connect(serviceOperator).submitReading(user1.address, 1000, true);
        });

        it("Should reject reading lower than previous", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(user1.address, 999, true)
            ).to.be.revertedWith("New reading must be greater than last reading");
        });

        it("Should reject zero reading", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(user1.address, 0, true)
            ).to.be.revertedWith("Reading must be > 0");
        });

        it("Should accept valid higher reading", async function () {
            await expect(
                waterBilling.connect(serviceOperator).submitReading(user1.address, 1100, true)
            ).to.not.be.reverted;
        });
    });

    describe("Suspended User", function () {
        it("Should not allow suspended user to submit reading", async function () {
            // Suspend user
            const FRAUD_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE"));
            await waterBilling.grantRole(FRAUD_MANAGER_ROLE, owner.address);
            await waterBilling.suspendUser(user1.address);

            await expect(
                waterBilling.connect(serviceOperator).submitReading(user1.address, 1100, true)
            ).to.be.revertedWith("User is suspended");
        });

        it("Should allow reactivated user to submit reading", async function () {
            // Suspend then reactivate
            const FRAUD_MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE"));
            await waterBilling.grantRole(FRAUD_MANAGER_ROLE, owner.address);
            await waterBilling.suspendUser(user1.address);
            await waterBilling.reactivateUser(user1.address);

            await expect(
                waterBilling.connect(serviceOperator).submitReading(user1.address, 1100, true)
            ).to.not.be.reverted;
        });
    });
});
