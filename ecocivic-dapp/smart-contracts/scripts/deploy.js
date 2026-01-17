const hre = require("hardhat");

async function deployToken() {
  const BELTToken = await hre.ethers.getContractFactory("BELTToken");
  const beltToken = await BELTToken.deploy();
  await beltToken.waitForDeployment();
  console.log("BELTToken deployed to:", await beltToken.getAddress());
  return beltToken;
}

async function deployRewards(tokenAddress) {
  const RecyclingRewards = await hre.ethers.getContractFactory("RecyclingRewards");
  const recyclingRewards = await RecyclingRewards.deploy(tokenAddress);
  await recyclingRewards.waitForDeployment();
  console.log("RecyclingRewards deployed to:", await recyclingRewards.getAddress());
  return recyclingRewards;
}

async function deployDeposit(depositTokenAddress, lendingPoolAddress) {
  const EcoCivicDeposit = await hre.ethers.getContractFactory("EcoCivicDeposit");
  const ecoCivicDeposit = await EcoCivicDeposit.deploy(depositTokenAddress, lendingPoolAddress);
  await ecoCivicDeposit.waitForDeployment();
  console.log("EcoCivicDeposit deployed to:", await ecoCivicDeposit.getAddress());
  return ecoCivicDeposit;
}

async function deployWaterBilling(tokenAddress) {
  const WaterBilling = await hre.ethers.getContractFactory("WaterBilling");
  const waterBilling = await WaterBilling.deploy(tokenAddress);
  await waterBilling.waitForDeployment();
  console.log("WaterBilling deployed to:", await waterBilling.getAddress());
  return waterBilling;
}

async function deployFraudManager(depositAddress) {
  const WaterBillingFraudManager = await hre.ethers.getContractFactory("WaterBillingFraudManager");
  const fraudManager = await WaterBillingFraudManager.deploy(depositAddress);
  await fraudManager.waitForDeployment();
  console.log("WaterBillingFraudManager deployed to:", await fraudManager.getAddress());
  return fraudManager;
}

async function main() {
  console.log("Starting deployment...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy BELT Token
  const beltToken = await deployToken();

  // 2. Deploy Recycling Rewards
  const recyclingRewards = await deployRewards(await beltToken.getAddress());

  // 3. Grant MINTER_ROLE to RecyclingRewards
  console.log("-------------------------------------------------------------");
  console.log("Granting MINTER_ROLE to RecyclingRewards contract...");
  console.log("-------------------------------------------------------------");

  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  await beltToken.grantRole(MINTER_ROLE, await recyclingRewards.getAddress());
  console.log("MINTER_ROLE granted successfully.");

  // 4. Deploy Deposit System
  let depositTokenAddress = process.env.USDC_ADDRESS;
  let lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;

  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    console.log("Local network detected. Deploying Mocks...");

    // Deploy Mock ERC20
    const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("Mock USDC", "mUSDC");
    await mockUSDC.waitForDeployment();
    depositTokenAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", depositTokenAddress);

    // Deploy Mock LendingPool
    const MockLendingPool = await hre.ethers.getContractFactory("MockLendingPool");
    const mockPool = await MockLendingPool.deploy();
    await mockPool.waitForDeployment();
    lendingPoolAddress = await mockPool.getAddress();
    console.log("Mock LendingPool deployed to:", lendingPoolAddress);
  }

  if (!depositTokenAddress || !lendingPoolAddress) {
    throw new Error("Missing USDC or LendingPool address. Set them in .env or use local network.");
  }

  const ecoCivicDeposit = await deployDeposit(depositTokenAddress, lendingPoolAddress);

  // 5. Deploy WaterBilling
  console.log("-------------------------------------------------------------");
  console.log("Deploying WaterBilling contract...");
  console.log("-------------------------------------------------------------");
  const waterBilling = await deployWaterBilling(await beltToken.getAddress());

  // Grant MINTER_ROLE to WaterBilling
  await beltToken.grantRole(MINTER_ROLE, await waterBilling.getAddress());
  console.log("MINTER_ROLE granted to WaterBilling.");

  // 6. Deploy WaterBillingFraudManager
  console.log("-------------------------------------------------------------");
  console.log("Deploying WaterBillingFraudManager contract...");
  console.log("-------------------------------------------------------------");
  const fraudManager = await deployFraudManager(await ecoCivicDeposit.getAddress());

  // Grant FRAUD_MANAGER_ROLE to FraudManager on WaterBilling
  const FRAUD_MANAGER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("FRAUD_MANAGER_ROLE"));
  await waterBilling.grantRole(FRAUD_MANAGER_ROLE, await fraudManager.getAddress());
  console.log("FRAUD_MANAGER_ROLE granted to FraudManager on WaterBilling.");

  // Transfer ownership of EcoCivicDeposit to FraudManager (so it can withdraw penalties)
  // Note: In production, you may want a multi-sig or DAO for this
  console.log("Transferring EcoCivicDeposit ownership to FraudManager...");
  await ecoCivicDeposit.transferOwnership(await fraudManager.getAddress());
  console.log("Ownership transferred.");

  console.log("\n=============================================================");
  console.log("Deployment complete! Contract addresses:");
  console.log("=============================================================");
  console.log("BELTToken:", await beltToken.getAddress());
  console.log("RecyclingRewards:", await recyclingRewards.getAddress());
  console.log("EcoCivicDeposit:", await ecoCivicDeposit.getAddress());
  console.log("WaterBilling:", await waterBilling.getAddress());
  console.log("WaterBillingFraudManager:", await fraudManager.getAddress());
  console.log("=============================================================");

  // 7. Grant backend wallet (Hardhat account #1) the necessary roles
  console.log("\n-------------------------------------------------------------");
  console.log("Granting roles to backend wallet (for API operations)...");
  console.log("-------------------------------------------------------------");

  // Backend wallet - Hardhat account #0 (same as deployer)
  // This is the wallet configured in backend-ai/.env
  const BACKEND_WALLET = deployer.address;

  // Grant MUNICIPALITY_STAFF_ROLE on RecyclingRewards
  const MUNICIPALITY_STAFF_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MUNICIPALITY_STAFF_ROLE"));
  await recyclingRewards.grantRole(MUNICIPALITY_STAFF_ROLE, BACKEND_WALLET);
  console.log("MUNICIPALITY_STAFF_ROLE granted to backend wallet on RecyclingRewards");

  // Grant SERVICE_OPERATOR_ROLE on RecyclingRewards
  const SERVICE_OPERATOR_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SERVICE_OPERATOR_ROLE"));
  await recyclingRewards.grantRole(SERVICE_OPERATOR_ROLE, BACKEND_WALLET);
  console.log("SERVICE_OPERATOR_ROLE granted to backend wallet on RecyclingRewards");

  // Grant SERVICE_OPERATOR_ROLE on WaterBilling
  await waterBilling.grantRole(SERVICE_OPERATOR_ROLE, BACKEND_WALLET);
  console.log("SERVICE_OPERATOR_ROLE granted to backend wallet on WaterBilling");

  // Grant AI_VERIFIER_ROLE on WaterBilling (for fraud evidence submission)
  const AI_VERIFIER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("AI_VERIFIER_ROLE"));
  try {
    await waterBilling.grantRole(AI_VERIFIER_ROLE, BACKEND_WALLET);
    console.log("AI_VERIFIER_ROLE granted to backend wallet on WaterBilling");
  } catch (e) {
    console.log("AI_VERIFIER_ROLE not available on WaterBilling (optional)");
  }

  console.log("=============================================================");
  console.log("\nUpdate your .env files with these addresses!");
  console.log("Backend wallet:", BACKEND_WALLET);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});