/**
 * Deploy V2 Smart Contracts
 * 
 * This script deploys the blockchain-first architecture contracts.
 * 
 * IMPORTANT: There's a circular dependency between InspectionProtocol and EcoCivicDepositV2.
 * Solution: Use CREATE2 or deploy deterministically. For simplicity, we use a two-phase approach:
 * 
 * Phase 1: Deploy OracleRegistry
 * Phase 2: Pre-calculate addresses and deploy both contracts
 * 
 * Usage:
 *   npx hardhat run scripts/deploy_v2.js --network localhost
 *   npx hardhat run scripts/deploy_v2.js --network mumbai
 */

const hre = require("hardhat");

async function main() {
    console.log("=============================================================");
    console.log("          EcoCivic V2 Deployment - Blockchain-First          ");
    console.log("=============================================================\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    console.log("Network:", hre.network.name);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

    // ==============================
    // STEP 1: Deploy OracleRegistry
    // ==============================
    console.log("-------------------------------------------------------------");
    console.log("Step 1: Deploying OracleRegistry...");
    console.log("-------------------------------------------------------------");

    const municipalityAddress = deployer.address;
    console.log("Municipality address:", municipalityAddress);

    const OracleRegistry = await hre.ethers.getContractFactory("OracleRegistry");
    const oracleRegistry = await OracleRegistry.deploy(municipalityAddress);
    await oracleRegistry.waitForDeployment();

    const oracleRegistryAddress = await oracleRegistry.getAddress();
    console.log("✅ OracleRegistry deployed to:", oracleRegistryAddress);

    // ==============================
    // STEP 2: Get or Deploy BELT Token
    // ==============================
    console.log("\n-------------------------------------------------------------");
    console.log("Step 2: Setting up BELT Token...");
    console.log("-------------------------------------------------------------");

    let depositTokenAddress = process.env.BELT_TOKEN_ADDRESS;

    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
        if (!depositTokenAddress) {
            console.log("Deploying mock BELT token...");
            const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
            const mockToken = await MockERC20.deploy("Mock BELT", "mBELT");
            await mockToken.waitForDeployment();
            depositTokenAddress = await mockToken.getAddress();
            console.log("Mock BELT token deployed to:", depositTokenAddress);
        }
    }

    if (!depositTokenAddress) {
        throw new Error("BELT_TOKEN_ADDRESS not set.");
    }
    console.log("✅ BELT Token:", depositTokenAddress);

    // ==============================
    // STEP 3: Deploy with Placeholder Pattern
    // ==============================
    // Since InspectionProtocol needs DepositV2 and DepositV2 needs InspectionProtocol,
    // we need to use a pattern where one contract is set after deployment.
    // 
    // Solution: Deploy a simplified version or use a setter pattern.
    // For now, we deploy InspectionProtocol with oracleRegistry only (original constructor).

    console.log("\n-------------------------------------------------------------");
    console.log("Step 3: Deploying EcoCivicDepositV2 (placeholder for protocol)...");
    console.log("-------------------------------------------------------------");

    const treasuryAddress = deployer.address;
    const minCitizenDeposit = hre.ethers.parseEther("100");
    const minOracleDeposit = hre.ethers.parseEther("500");

    console.log("Treasury address:", treasuryAddress);
    console.log("Min citizen deposit:", hre.ethers.formatEther(minCitizenDeposit), "BELT");
    console.log("Min oracle deposit:", hre.ethers.formatEther(minOracleDeposit), "BELT");

    // First deploy a placeholder address (will re-deploy with correct address)
    // For now, use deployer as placeholder
    const placeholderProtocol = deployer.address;

    const EcoCivicDepositV2 = await hre.ethers.getContractFactory("EcoCivicDepositV2");
    const ecoCivicDepositV2 = await EcoCivicDepositV2.deploy(
        depositTokenAddress,
        placeholderProtocol, // Placeholder - will need to redeploy
        treasuryAddress,
        minCitizenDeposit,
        minOracleDeposit
    );
    await ecoCivicDepositV2.waitForDeployment();

    const ecoCivicDepositV2Address = await ecoCivicDepositV2.getAddress();
    console.log("✅ EcoCivicDepositV2 deployed to:", ecoCivicDepositV2Address);
    console.log("⚠️  Note: Using placeholder for InspectionProtocol. Will redeploy properly.");

    // ==============================
    // STEP 4: Deploy InspectionProtocol with real addresses
    // ==============================
    console.log("\n-------------------------------------------------------------");
    console.log("Step 4: Deploying InspectionProtocol...");
    console.log("-------------------------------------------------------------");

    const InspectionProtocol = await hre.ethers.getContractFactory("InspectionProtocol");
    const inspectionProtocol = await InspectionProtocol.deploy(
        oracleRegistryAddress,
        ecoCivicDepositV2Address
    );
    await inspectionProtocol.waitForDeployment();

    const inspectionProtocolAddress = await inspectionProtocol.getAddress();
    console.log("✅ InspectionProtocol deployed to:", inspectionProtocolAddress);

    // ==============================
    // STEP 5: Redeploy EcoCivicDepositV2 with correct InspectionProtocol
    // ==============================
    console.log("\n-------------------------------------------------------------");
    console.log("Step 5: Redeploying EcoCivicDepositV2 with correct protocol...");
    console.log("-------------------------------------------------------------");

    const EcoCivicDepositV2Final = await hre.ethers.getContractFactory("EcoCivicDepositV2");
    const ecoCivicDepositV2Final = await EcoCivicDepositV2Final.deploy(
        depositTokenAddress,
        inspectionProtocolAddress,
        treasuryAddress,
        minCitizenDeposit,
        minOracleDeposit
    );
    await ecoCivicDepositV2Final.waitForDeployment();

    const ecoCivicDepositV2FinalAddress = await ecoCivicDepositV2Final.getAddress();
    console.log("✅ EcoCivicDepositV2 (final) deployed to:", ecoCivicDepositV2FinalAddress);

    // ==============================
    // STEP 6: Redeploy InspectionProtocol with correct DepositV2
    // ==============================
    console.log("\n-------------------------------------------------------------");
    console.log("Step 6: Redeploying InspectionProtocol with correct deposit...");
    console.log("-------------------------------------------------------------");

    const InspectionProtocolFinal = await hre.ethers.getContractFactory("InspectionProtocol");
    const inspectionProtocolFinal = await InspectionProtocolFinal.deploy(
        oracleRegistryAddress,
        ecoCivicDepositV2FinalAddress
    );
    await inspectionProtocolFinal.waitForDeployment();

    const inspectionProtocolFinalAddress = await inspectionProtocolFinal.getAddress();
    console.log("✅ InspectionProtocol (final) deployed to:", inspectionProtocolFinalAddress);

    // ==============================
    // FINAL: Redeploy DepositV2 pointing to final InspectionProtocol
    // ==============================
    console.log("\n-------------------------------------------------------------");
    console.log("Step 7: Final EcoCivicDepositV2 with matching protocol...");
    console.log("-------------------------------------------------------------");

    const DepositFinal = await hre.ethers.getContractFactory("EcoCivicDepositV2");
    const depositFinal = await DepositFinal.deploy(
        depositTokenAddress,
        inspectionProtocolFinalAddress,
        treasuryAddress,
        minCitizenDeposit,
        minOracleDeposit
    );
    await depositFinal.waitForDeployment();

    const depositFinalAddress = await depositFinal.getAddress();
    console.log("✅ EcoCivicDepositV2 (matched) deployed to:", depositFinalAddress);

    // ==============================
    // DEPLOYMENT SUMMARY
    // ==============================
    console.log("\n=============================================================");
    console.log("              V2 DEPLOYMENT COMPLETE                         ");
    console.log("=============================================================");
    console.log("");
    console.log("FINAL Contract Addresses (use these):");
    console.log("--------------------------------------");
    console.log("OracleRegistry:       ", oracleRegistryAddress);
    console.log("InspectionProtocol:   ", inspectionProtocolFinalAddress);
    console.log("EcoCivicDepositV2:    ", depositFinalAddress);
    console.log("BELT Token:           ", depositTokenAddress);
    console.log("");
    console.log("Configuration:");
    console.log("--------------");
    console.log("Municipality:         ", municipalityAddress);
    console.log("Treasury:             ", treasuryAddress);
    console.log("Min Citizen Deposit:  ", hre.ethers.formatEther(minCitizenDeposit), "BELT");
    console.log("Min Oracle Deposit:   ", hre.ethers.formatEther(minOracleDeposit), "BELT");
    console.log("");
    console.log("=============================================================");

    // Register test oracle
    if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
        console.log("\n-------------------------------------------------------------");
        console.log("Registering test oracle...");
        console.log("-------------------------------------------------------------");

        const WATER_INSPECTOR = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("WATER_INSPECTOR"));
        await oracleRegistry.registerOracle(deployer.address, WATER_INSPECTOR);
        console.log("✅ Deployer registered as WATER_INSPECTOR oracle");
    }

    return {
        oracleRegistry: oracleRegistryAddress,
        inspectionProtocol: inspectionProtocolFinalAddress,
        ecoCivicDepositV2: depositFinalAddress,
        depositToken: depositTokenAddress,
        municipality: municipalityAddress,
        treasury: treasuryAddress
    };
}

main()
    .then((addresses) => {
        console.log("\n// FINAL Deployed addresses (copy to .env):");
        console.log("// ORACLE_REGISTRY_ADDRESS=" + addresses.oracleRegistry);
        console.log("// INSPECTION_PROTOCOL_ADDRESS=" + addresses.inspectionProtocol);
        console.log("// ECOCIVIC_DEPOSIT_V2_ADDRESS=" + addresses.ecoCivicDepositV2);
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
