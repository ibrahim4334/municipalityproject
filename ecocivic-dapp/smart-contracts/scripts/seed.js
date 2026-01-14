const hre = require("hardhat");

/**
 * Seed Script
 * Creates test data for local development
 */
async function main() {
    console.log("🌱 Starting seed script...\n");

    const [deployer, operator, citizen1, citizen2, citizen3] = await hre.ethers.getSigners();

    console.log("📍 Accounts:");
    console.log("  Deployer:", deployer.address);
    console.log("  Operator:", operator.address);
    console.log("  Citizen1:", citizen1.address);
    console.log("  Citizen2:", citizen2.address);
    console.log("  Citizen3:", citizen3.address);
    console.log();

    // Get deployed contract addresses from environment or use defaults
    const BELT_TOKEN_ADDRESS = process.env.BELT_TOKEN_ADDRESS;
    const RECYCLING_REWARDS_ADDRESS = process.env.RECYCLING_REWARDS_ADDRESS;
    const WATER_BILLING_ADDRESS = process.env.WATER_BILLING_ADDRESS;

    if (!BELT_TOKEN_ADDRESS) {
        console.log("⚠️  No contract addresses found. Please run deploy script first.");
        console.log("   Then set environment variables:");
        console.log("   BELT_TOKEN_ADDRESS=0x...");
        console.log("   RECYCLING_REWARDS_ADDRESS=0x...");
        console.log("   WATER_BILLING_ADDRESS=0x...");
        return;
    }

    // Connect to contracts
    const beltToken = await hre.ethers.getContractAt("BELTToken", BELT_TOKEN_ADDRESS);
    const recyclingRewards = await hre.ethers.getContractAt("RecyclingRewards", RECYCLING_REWARDS_ADDRESS);

    console.log("📜 Connected to contracts");

    // Grant SERVICE_OPERATOR_ROLE to operator
    const SERVICE_OPERATOR_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("SERVICE_OPERATOR_ROLE"));

    console.log("\n🔐 Granting roles...");

    if (!(await recyclingRewards.hasRole(SERVICE_OPERATOR_ROLE, operator.address))) {
        await recyclingRewards.grantRole(SERVICE_OPERATOR_ROLE, operator.address);
        console.log("  ✅ Granted SERVICE_OPERATOR_ROLE to operator");
    } else {
        console.log("  ⏭️  Operator already has SERVICE_OPERATOR_ROLE");
    }

    // Simulate some recycling rewards
    console.log("\n♻️  Creating sample recycling rewards...");

    const recyclingData = [
        { user: citizen1, material: 0, amount: 100, qrHash: "seed_qr_glass_001" },   // Glass
        { user: citizen1, material: 1, amount: 50, qrHash: "seed_qr_paper_001" },    // Paper
        { user: citizen2, material: 2, amount: 200, qrHash: "seed_qr_metal_001" },   // Metal
        { user: citizen2, material: 0, amount: 75, qrHash: "seed_qr_glass_002" },    // Glass
        { user: citizen3, material: 1, amount: 150, qrHash: "seed_qr_paper_002" },   // Paper
    ];

    for (const item of recyclingData) {
        try {
            const tx = await recyclingRewards.connect(operator).rewardRecycling(
                item.user.address,
                item.material,
                item.amount,
                item.qrHash
            );
            await tx.wait();

            const materialNames = ["Glass", "Paper", "Metal"];
            console.log(`  ✅ Rewarded ${item.user.address.slice(0, 8)}... for ${item.amount}kg ${materialNames[item.material]}`);
        } catch (err) {
            if (err.message.includes("already used")) {
                console.log(`  ⏭️  QR hash ${item.qrHash} already used, skipping`);
            } else {
                console.log(`  ❌ Error: ${err.message}`);
            }
        }
    }

    // Display final balances
    console.log("\n💰 Final BELT balances:");
    console.log(`  Citizen1: ${hre.ethers.formatEther(await beltToken.balanceOf(citizen1.address))} BELT`);
    console.log(`  Citizen2: ${hre.ethers.formatEther(await beltToken.balanceOf(citizen2.address))} BELT`);
    console.log(`  Citizen3: ${hre.ethers.formatEther(await beltToken.balanceOf(citizen3.address))} BELT`);

    console.log("\n✅ Seed script completed!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});