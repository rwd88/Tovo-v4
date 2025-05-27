// Add basic commands:
export async function handleCommand(command: string) {
  switch(command) {
    case '/markets':
      return listActiveMarkets();
    case '/leaderboard':
      return showLeaderboard();
    default:
      return 'Unknown command';
  }
}