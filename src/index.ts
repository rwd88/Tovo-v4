import { startEvmDepositMonitor }   from './services/evmDepositMonitor';
import { startErc20DepositMonitor } from './services/erc20DepositMonitor';
import { startTronDepositMonitor }  from './services/tronDepositMonitor';

async function main() {
  await startEvmDepositMonitor();
  startErc20DepositMonitor();
  startTronDepositMonitor();
  console.log('All deposit monitors running');
}

main().catch(console.error);
