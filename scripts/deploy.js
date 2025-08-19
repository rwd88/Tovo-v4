async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const contract = await PredictionMarket.deploy(
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet address (replace with testnet USDC)
    "0xYourAdminWallet"                          // your admin wallet
  );

  await contract.deployed();
  console.log("PredictionMarket deployed to:", contract.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
