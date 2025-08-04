// scripts/compile.js
const hre = require("hardhat");

async function main() {
  await hre.run('compile');
  console.log("✅ Contract compiled.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
