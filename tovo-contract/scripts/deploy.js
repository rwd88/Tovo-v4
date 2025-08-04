const hre = require("hardhat");

async function main() {
  // Compile contracts (optional if already compiled)
  await hre.run("compile");

  // Get the contract factory and deploy
  const TovoPrediction = await hre.ethers.getContractFactory("TovoPrediction");
  const contract = await TovoPrediction.deploy();

  // Wait for deployment
  await contract.deployed();

  console.log("✅ Contract deployed to:", contract.address);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
