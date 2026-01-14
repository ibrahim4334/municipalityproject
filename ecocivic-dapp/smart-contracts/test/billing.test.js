const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("WaterBilling", function () {
    let BELTToken, beltToken;
    let WaterBilling, waterBilling;
    let owner, operator, user1, user2;

    const SERVICE_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("SERVICE_OPERATOR_ROLE"));

    beforeEach(async function () {
        [owner, operator, user1, user2] = await ethers.getSigners();

        // Deploy BELT Token
        BELTToken = await ethers.getContractFactory("BELTToken");
        beltToken = await BELTToken.deploy();

        // Deploy WaterBilling
        WaterBilling = await ethers.getContractFactory("WaterBilling");
        waterBilling = await WaterBilling.deploy(await beltToken.getAddress());

        // Grant MINTER_ROLE to WaterBilling contract so it can mint rewards
        const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
        await beltToken.grantRole(MINTER_ROLE, await waterBilling.getAddress());

        // Grant SERVICE_OPERATOR_ROLE to operator
        await waterBilling.grantRole(SERVICE_OPERATOR_ROLE, operator.address);
    });

    describe("Deployment", function () {
        it("Should set the correct BELT token address", async function () {
            expect(await waterBilling.beltToken()).to.equal(await beltToken.getAddress());
        });

        it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await waterBilling.DEFAULT_ADMIN_ROLE();
            expect(await waterBilling.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should grant SERVICE_OPERATOR_ROLE to deployer", async function () {
            expect(await waterBilling.hasRole(SERVICE_OPERATOR_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Submit Reading", function () {
        it("Should submit first reading and reward user", async function () {
            const reading = 100;

            await expect(waterBilling.connect(operator).submitReading(user1.address, reading))
                .to.emit(waterBilling, "ReadingSubmitted")
                .withArgs(user1.address, reading, reading);

            expect(await waterBilling.lastReading(user1.address)).to.equal(reading);
            expect(await beltToken.balanceOf(user1.address)).to.equal(reading);
        });

        it("Should calculate correct reward for subsequent readings", async function () {
            const firstReading = 100;
            const secondReading = 150;
            const expectedReward = secondReading - firstReading; // 50

            await waterBilling.connect(operator).submitReading(user1.address, firstReading);
            await waterBilling.connect(operator).submitReading(user1.address, secondReading);

            expect(await waterBilling.lastReading(user1.address)).to.equal(secondReading);
            // First reward (100) + second reward (50) = 150
            expect(await beltToken.balanceOf(user1.address)).to.equal(firstReading + expectedReward);
        });

        it("Should reject reading from non-operator", async function () {
            await expect(
                waterBilling.connect(user1).submitReading(user1.address, 100)
            ).to.be.revertedWithCustomError(waterBilling, "AccessControlUnauthorizedAccount");
        });

        it("Should reject zero address", async function () {
            await expect(
                waterBilling.connect(operator).submitReading(ethers.ZeroAddress, 100)
            ).to.be.revertedWith("Invalid user address");
        });

        it("Should reject zero reading", async function () {
            await expect(
                waterBilling.connect(operator).submitReading(user1.address, 0)
            ).to.be.revertedWith("Reading must be > 0");
        });

        it("Should reject reading less than or equal to previous", async function () {
            await waterBilling.connect(operator).submitReading(user1.address, 100);

            await expect(
                waterBilling.connect(operator).submitReading(user1.address, 100)
            ).to.be.revertedWith("New reading must be greater than last reading");

            await expect(
                waterBilling.connect(operator).submitReading(user1.address, 50)
            ).to.be.revertedWith("New reading must be greater than last reading");
        });
    });

    describe("Multiple Users", function () {
        it("Should track readings independently for each user", async function () {
            await waterBilling.connect(operator).submitReading(user1.address, 100);
            await waterBilling.connect(operator).submitReading(user2.address, 200);

            expect(await waterBilling.lastReading(user1.address)).to.equal(100);
            expect(await waterBilling.lastReading(user2.address)).to.equal(200);

            expect(await beltToken.balanceOf(user1.address)).to.equal(100);
            expect(await beltToken.balanceOf(user2.address)).to.equal(200);
        });
    });

    describe("Access Control", function () {
        it("Should allow admin to grant operator role", async function () {
            await waterBilling.grantRole(SERVICE_OPERATOR_ROLE, user2.address);
            expect(await waterBilling.hasRole(SERVICE_OPERATOR_ROLE, user2.address)).to.be.true;
        });

        it("Should allow admin to revoke operator role", async function () {
            await waterBilling.revokeRole(SERVICE_OPERATOR_ROLE, operator.address);
            expect(await waterBilling.hasRole(SERVICE_OPERATOR_ROLE, operator.address)).to.be.false;
        });

        it("Should not allow non-admin to grant roles", async function () {
            await expect(
                waterBilling.connect(user1).grantRole(SERVICE_OPERATOR_ROLE, user2.address)
            ).to.be.revertedWithCustomError(waterBilling, "AccessControlUnauthorizedAccount");
        });
    });
});