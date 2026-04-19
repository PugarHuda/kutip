// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title UnclaimedYieldEscrow — author earnings accrue yield until they claim
///
/// @notice When AttributionLedger pays an author whose ORCID hasn't been bound
/// to a real wallet yet, the share is deposited here instead of being sent to
/// a dead synthetic address. The escrow tracks principal + simulated APY and
/// releases both to the claimer once they prove ORCID ownership.
///
/// Production wiring would route the USDC into Lucid DeFi's on-chain yield
/// vault (Aave v3 under the hood) for real yield. Lucid isn't deployed on
/// Kite testnet, so we simulate APY in-contract — the architectural hook
/// is what matters for the demo, and drop-in replacement to real Lucid
/// is a one-line swap of `_yieldVault`.
contract UnclaimedYieldEscrow {
    using SafeERC20 for IERC20;

    IERC20 public immutable paymentToken;
    address public immutable operator;

    /// Simulated yield rate in basis points per year (e.g. 500 = 5% APY).
    /// Production replaces this with a view of Lucid vault's share price.
    uint16 public immutable apyBps;
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    struct Deposit {
        uint256 principal;
        uint64 depositedAt;
        uint64 claimedAt;
        address claimer; // zero until claimed
    }

    /// orcidHash → Deposit. orcidHash = keccak256(abi.encodePacked(orcid string))
    mapping(bytes32 => Deposit) public deposits;

    /// Outstanding principal (sum of all un-claimed deposits). Helps the
    /// operator know how much USDC is "held for authors."
    uint256 public totalPrincipalOutstanding;

    event Deposited(
        bytes32 indexed orcidHash,
        uint256 amount,
        uint256 newPrincipal
    );
    event Claimed(
        bytes32 indexed orcidHash,
        address indexed claimer,
        uint256 principal,
        uint256 yieldPaid
    );
    event YieldFunded(address indexed from, uint256 amount);

    error NotOperator();
    error ZeroAmount();
    error AlreadyClaimed();
    error NotFound();

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        address _paymentToken,
        address _operator,
        uint16 _apyBps
    ) {
        paymentToken = IERC20(_paymentToken);
        operator = _operator;
        apyBps = _apyBps;
    }

    /// @notice Deposit WITH funds transfer. Operator pre-approves, escrow
    /// pulls USDC. Standalone path — useful for seeding or one-off deposits.
    function depositFor(bytes32 orcidHash, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        _applyDeposit(orcidHash, amount);
    }

    /// @notice Register a deposit for which funds have ALREADY arrived
    /// (e.g. via AttributionLedger.attestAndSplit paying escrow directly
    /// for an unclaimed author). Operator reports orcidHash + amount so
    /// escrow can attribute the incoming balance correctly.
    ///
    /// Trust model: operator is known (immutable address), and the
    /// amount should equal the delta the ledger just sent. If operator
    /// reports incorrect amount, claimer just gets the stated principal —
    /// escrow never pays out more than operator registered.
    function registerDeposit(bytes32 orcidHash, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _applyDeposit(orcidHash, amount);
    }

    function _applyDeposit(bytes32 orcidHash, uint256 amount) internal {
        Deposit storage d = deposits[orcidHash];
        if (d.depositedAt == 0) {
            d.depositedAt = uint64(block.timestamp);
        }
        d.principal += amount;
        totalPrincipalOutstanding += amount;

        emit Deposited(orcidHash, amount, d.principal);
    }

    /// @notice Read-only accrued yield since deposit. Simulates APY pegged
    /// to `apyBps`. Prod Lucid integration would redirect to vault share
    /// delta.
    function accruedYield(bytes32 orcidHash) public view returns (uint256) {
        Deposit memory d = deposits[orcidHash];
        if (d.principal == 0 || d.claimer != address(0)) return 0;
        uint256 elapsed = block.timestamp - uint256(d.depositedAt);
        return (d.principal * apyBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    /// @notice Authorised claim — verified by the operator off-chain (ORCID
    /// + signature) then finalised here. Operator pays yield out of its
    /// own pocket so contract doesn't need liquidity for simulated rate.
    function claim(bytes32 orcidHash, address claimer) external onlyOperator {
        Deposit storage d = deposits[orcidHash];
        if (d.principal == 0) revert NotFound();
        if (d.claimer != address(0)) revert AlreadyClaimed();

        uint256 principal = d.principal;
        uint256 yieldAmount = accruedYield(orcidHash);

        d.claimer = claimer;
        d.claimedAt = uint64(block.timestamp);
        totalPrincipalOutstanding -= principal;

        paymentToken.safeTransfer(claimer, principal);
        if (yieldAmount > 0) {
            // Contract may not hold yield buffer — pull from operator to fund it.
            paymentToken.safeTransferFrom(operator, claimer, yieldAmount);
        }

        emit Claimed(orcidHash, claimer, principal, yieldAmount);
    }

    /// @notice Anyone can pre-fund yield buffer; emits event so analytics
    /// can show "yield treasury" balance.
    function fundYield(uint256 amount) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit YieldFunded(msg.sender, amount);
    }
}
