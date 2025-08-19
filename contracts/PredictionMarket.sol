// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PredictionMarket is Ownable {
    IERC20 public token; // USDC contract

    struct Market {
        string question;
        uint256 endTime;
        uint256 poolYes;
        uint256 poolNo;
        bool resolved;
        bool outcome; // true = YES, false = NO
    }

    uint256 public constant TRADE_FEE_BPS = 100;   // 1% per trade
    uint256 public constant LOSER_FEE_BPS = 1000;  // 10% of losing pool

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint256)) public betsYes;
    mapping(uint256 => mapping(address => uint256)) public betsNo;
    uint256 public marketCount;

    address public feeWallet;

    constructor(address _token, address _feeWallet) {
        token = IERC20(_token);
        feeWallet = _feeWallet;
    }

    // --- Create Market ---
    function createMarket(string memory question, uint256 endTime) external onlyOwner {
        markets[marketCount] = Market({
            question: question,
            endTime: endTime,
            poolYes: 0,
            poolNo: 0,
            resolved: false,
            outcome: false
        });
        marketCount++;
    }

    // --- Place Bet ---
    function placeBet(uint256 marketId, bool side, uint256 amount) external {
        Market storage m = markets[marketId];
        require(block.timestamp < m.endTime, "Market closed");
        require(!m.resolved, "Market resolved");

        // Take fee
        uint256 fee = (amount * TRADE_FEE_BPS) / 10000;
        require(token.transferFrom(msg.sender, feeWallet, fee), "Fee transfer failed");
        uint256 net = amount - fee;

        require(token.transferFrom(msg.sender, address(this), net), "Bet transfer failed");

        if (side) {
            m.poolYes += net;
            betsYes[marketId][msg.sender] += net;
        } else {
            m.poolNo += net;
            betsNo[marketId][msg.sender] += net;
        }
    }

    // --- Resolve Market ---
    function resolveMarket(uint256 marketId, bool outcome) external onlyOwner {
        Market storage m = markets[marketId];
        require(block.timestamp >= m.endTime, "Market still running");
        require(!m.resolved, "Already resolved");

        m.resolved = true;
        m.outcome = outcome;

        // loser pool fee → admin
        uint256 loserPool = outcome ? m.poolNo : m.poolYes;
        uint256 adminCut = (loserPool * LOSER_FEE_BPS) / 10000;
        require(token.transfer(feeWallet, adminCut), "Admin cut failed");
    }

    // --- Claim Winnings ---
    function claim(uint256 marketId) external {
        Market storage m = markets[marketId];
        require(m.resolved, "Not resolved yet");

        uint256 share;
        if (m.outcome) {
            uint256 userBet = betsYes[marketId][msg.sender];
            require(userBet > 0, "No winning bet");
            uint256 winnerPool = m.poolYes;
            uint256 loserPool = m.poolNo;
            uint256 adminCut = (loserPool * LOSER_FEE_BPS) / 10000;
            uint256 distributable = loserPool - adminCut + winnerPool;
            share = (userBet * distributable) / winnerPool;
            betsYes[marketId][msg.sender] = 0;
        } else {
            uint256 userBet = betsNo[marketId][msg.sender];
            require(userBet > 0, "No winning bet");
            uint256 winnerPool = m.poolNo;
            uint256 loserPool = m.poolYes;
            uint256 adminCut = (loserPool * LOSER_FEE_BPS) / 10000;
            uint256 distributable = loserPool - adminCut + winnerPool;
            share = (userBet * distributable) / winnerPool;
            betsNo[marketId][msg.sender] = 0;
        }

        require(token.transfer(msg.sender, share), "Payout failed");
    }
}
