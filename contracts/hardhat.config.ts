// contracts/hardhat.config.ts
import { HardhatUserConfig, configVariable } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-verify";

const config: HardhatUserConfig = {
  defaultNetwork: "sepolia", // << testnet by default
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    hardhat:   { type: "edr-simulated" },
    localhost: { type: "http", url: "http://127.0.0.1:8545" },
    sepolia:   {
      type: "http",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    // mainnet intentionally omitted while testing
  },
  etherscan: { apiKey: configVariable("ETHERSCAN_API_KEY") },
};
export default config;
