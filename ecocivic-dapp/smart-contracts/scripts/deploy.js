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

  await deployDeposit(depositTokenAddress, lendingPoolAddress);

  console.log("Deployment complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});