// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TovoPrediction {
    address public admin;
    uint256 public tradeFeePercent = 1;

    struct Market {
        uint256 id;
        string question;
        uint256 forecast;
        uint256 endTime;
        uint256 poolYes;
        uint256 poolNo;
        bool settled;
        bool outcomeYes;
    }

    struct Trade {
        uint256 marketId;
        address user;
        bool side; // true = Yes, false = No
        uint256 amount;
    }

    uint256 public marketCounter;
    mapping(uint256 => Market) public markets;
    mapping(address => uint256) public balances;
    mapping(uint256 => Trade[]) public marketTrades;

    constructor() {
        admin = msg.sender;
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function createMarket(string memory _question, uint256 _forecast, uint256 _endTime) external {
        markets[marketCounter] = Market({
            id: marketCounter,
            question: _question,
            forecast: _forecast,
            endTime: _endTime,
            poolYes: 0,
            poolNo: 0,
            settled: false,
            outcomeYes: false
        });
        marketCounter++;
    }

    function placeBet(uint256 marketId, bool side, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Not enough balance");
        require(block.timestamp < markets[marketId].endTime, "Market closed");

        balances[msg.sender] -= amount;
        uint256 fee = (amount * tradeFeePercent) / 100;
        balances[admin] += fee;
        uint256 netAmount = amount - fee;

        if (side) {
            markets[marketId].poolYes += netAmount;
        } else {
            markets[marketId].poolNo += netAmount;
        }

        marketTrades[marketId].push(Trade({
            marketId: marketId,
            user: msg.sender,
            side: side,
            amount: netAmount
        }));
    }

    function settleMarket(uint256 marketId, bool outcomeYes) external {
        require(msg.sender == admin, "Only admin can settle");
        Market storage m = markets[marketId];
        require(!m.settled, "Already settled");
        require(block.timestamp > m.endTime, "Too early");

        m.settled = true;
        m.outcomeYes = outcomeYes;

        uint256 winningPool = outcomeYes ? m.poolYes : m.poolNo;
        uint256 losingPool = outcomeYes ? m.poolNo : m.poolYes;

        for (uint i = 0; i < marketTrades[marketId].length; i++) {
            Trade memory t = marketTrades[marketId][i];
            if (t.side == outcomeYes) {
                uint256 share = (t.amount * losingPool) / winningPool;
                balances[t.user] += t.amount + share;
            }
        }
    }
}
