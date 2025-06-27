import { startEvmDepositMonitor }   from './services/evmDepositMonitor';
import { startErc20DepositMonitor } from './services/erc20DepositMonitor';
import { startTronDepositMonitor }  from './services/tronDepositMonitor';
import { startSolanaDepositMonitor } from "./services/solanaDepositMonitor";
import { startSolanaSPLDepositMonitor } from "./services/solanaSPLDepositMonitor";

async function main() {
  await startEvmDepositMonitor();
  startErc20DepositMonitor();
  startTronDepositMonitor();
    await startSolanaDepositMonitor();
  await startSolanaSPLDepositMonitor();
  console.log('All deposit monitors running');
}

main().catch(console.error);
