// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Tovo Prediction Market (USDC-based)
/// @notice Fee policy:
///   - 1% fee on each trade -> sent to feeRecipient immediately
///   - On settlement: 10% of the *losing* pool -> sent to feeRecipient
///   - On winner claim: 1% withdraw fee -> sent to feeRecipient
contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ====== Config ======
    IERC20  public immutable token;          // e.g. USDC
    address public feeRecipient;             // admin/house wallet

    uint256 public constant BPS_DENOM        = 10_000;
    uint256 public constant TRADE_FEE_BPS     = 100;   // 1%
    uint256 public constant HOUSE_CUT_BPS     = 1000;  // 10% of losing pool
    uint256 public constant WITHDRAW_FEE_BPS  = 100;   // 1% on winner claim

    // ====== Types ======
    enum Side { None, Yes, No }
    enum Status { Open, Settled, Cancelled }

    struct Market {
        string  question;
        uint64  eventTime;       // unix seconds
        Status  status;
        Side    outcome;         // when settled
        uint128 poolYes;
        uint128 poolNo;
        uint128 winnerPayoutPerTokenX6; // fixed-point with 6 decimals
    }

    // marketId => user => stakeYes/stakeNo
    mapping(uint256 => mapping(address => uint128)) public stakeYes;
    mapping(uint256 => mapping(address => uint128)) public stakeNo;

    // marketId => user => claimed?
    mapping(uint256 => mapping(address => bool)) public claimed;

    // auto-incremented market ids start at 1
    uint256 public marketsCount;
    mapping(uint256 => Market) public markets;

    // ====== Events ======
    event MarketCreated(uint256 indexed marketId, string question, uint64 eventTime);
    event MarketClosed(uint256 indexed marketId);
    event BetPlaced(uint256 indexed marketId, address indexed user, Side side, uint128 amount, uint128 fee);
    event MarketSettled(uint256 indexed marketId, Side outcome, uint128 houseCut);
    event Claimed(uint256 indexed marketId, address indexed user, uint128 gross, uint128 withdrawFee, uint128 net);

    constructor(IERC20 _token, address _feeRecipient) Ownable(msg.sender) {
        require(address(_token) != address(0), "token=0");
        require(_feeRecipient != address(0), "feeRecipient=0");
        token = _token;
        feeRecipient = _feeRecipient;
    }

    // ====== Admin ======
    function setFeeRecipient(address _who) external onlyOwner {
        require(_who != address(0), "feeRecipient=0");
        feeRecipient = _who;
    }

    function createMarket(string calldata question, uint64 eventTime) external onlyOwner returns (uint256 id) {
        require(bytes(question).length > 0, "empty question");
        require(eventTime > block.timestamp, "time in past");

        id = ++marketsCount;
        markets[id] = Market({
            question: question,
            eventTime: eventTime,
            status: Status.Open,
            outcome: Side.None,
            poolYes: 0,
            poolNo: 0,
            winnerPayoutPerTokenX6: 0
        });

        emit MarketCreated(id, question, eventTime);
    }

    /// @notice Optional guard to prevent late trades close to event time
    function closeMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(m.status == Status.Open, "not open");
        m.status = Status.Cancelled; // if you prefer a "Closed" separate state, add it; here Cancelled = no trading
        emit MarketClosed(marketId);
    }

    /// @notice Settle with outcome. Winner can claim after.
    function settleMarket(uint256 marketId, Side outcome) external onlyOwner nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == Status.Open, "not open");
        require(outcome == Side.Yes || outcome == Side.No, "invalid outcome");
        require(block.timestamp >= m.eventTime, "too early");

        m.status = Status.Settled;
        m.outcome = outcome;

        uint256 poolYes = uint256(m.poolYes);
        uint256 poolNo  = uint256(m.poolNo);

        // 10% of losing pool -> admin
        uint256 losing = (outcome == Side.Yes) ? poolNo : poolYes;
        uint256 houseCut = (losing * HOUSE_CUT_BPS) / BPS_DENOM;
        if (houseCut > 0) {
            token.safeTransfer(feeRecipient, houseCut);
        }

        // remaining pot for winners
        uint256 totalPot = poolYes + poolNo;
        uint256 distributable = totalPot - houseCut;

        uint256 winnersPool = (outcome == Side.Yes) ? poolYes : poolNo;
        uint256 payoutPerTokenX6 = (winnersPool == 0) ? 0 : (distributable * 1e6) / winnersPool;
        m.winnerPayoutPerTokenX6 = uint128(payoutPerTokenX6);

        emit MarketSettled(marketId, outcome, uint128(houseCut));
    }

    // ====== Trading ======
    /// @notice Place bet. Requires prior ERC20 approve() for (amount + 1% fee).
    function bet(uint256 marketId, Side side, uint128 amount) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == Status.Open, "not open");
        require(block.timestamp < m.eventTime, "market closed");
        require(side == Side.Yes || side == Side.No, "invalid side");
        require(amount > 0, "amount=0");

        // 1% trade fee to feeRecipient
        uint128 fee = uint128((uint256(amount) * TRADE_FEE_BPS) / BPS_DENOM);
        uint256 total = uint256(amount) + fee;

        // pull funds from user
        token.safeTransferFrom(msg.sender, address(this), total);
        if (fee > 0) token.safeTransfer(feeRecipient, fee);

        if (side == Side.Yes) {
            m.poolYes += amount;
            stakeYes[marketId][msg.sender] += amount;
        } else {
            m.poolNo += amount;
            stakeNo[marketId][msg.sender] += amount;
        }

        emit BetPlaced(marketId, msg.sender, side, amount, fee);
    }

    // ====== Claim ======
    function previewClaim(uint256 marketId, address user) public view returns (uint128 gross, uint128 withdrawFee, uint128 net) {
        Market memory m = markets[marketId];
        if (m.status != Status.Settled) return (0,0,0);
        if (claimed[marketId][user]) return (0,0,0);

        uint128 userStake = (m.outcome == Side.Yes) ? stakeYes[marketId][user] : stakeNo[marketId][user];
        if (userStake == 0) return (0,0,0);

        // gross = userStake * payoutPerTokenX6 / 1e6
        gross = uint128((uint256(userStake) * uint256(m.winnerPayoutPerTokenX6)) / 1e6);
        withdrawFee = uint128((uint256(gross) * WITHDRAW_FEE_BPS) / BPS_DENOM);
        net = gross - withdrawFee;
    }

    function claim(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.status == Status.Settled, "not settled");
        require(!claimed[marketId][msg.sender], "already claimed");

        uint128 userStake = (m.outcome == Side.Yes) ? stakeYes[marketId][msg.sender] : stakeNo[marketId][msg.sender];
        require(userStake > 0, "no winnings");

        (uint128 gross, uint128 withdrawFee, uint128 net) = previewClaim(marketId, msg.sender);
        require(net > 0, "nothing to claim");

        // burn stake to prevent re-claim
        if (m.outcome == Side.Yes) {
            stakeYes[marketId][msg.sender] = 0;
        } else {
            stakeNo[marketId][msg.sender] = 0;
        }
        claimed[marketId][msg.sender] = true;

        if (withdrawFee > 0) token.safeTransfer(feeRecipient, withdrawFee);
        token.safeTransfer(msg.sender, net);

        emit Claimed(marketId, msg.sender, gross, withdrawFee, net);
    }
}
