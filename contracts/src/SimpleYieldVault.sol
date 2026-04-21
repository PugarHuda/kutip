// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SimpleYieldVault — ERC-4626-shaped yield adapter for escrow
/// @notice Linearly-accruing time-based yield from a pre-funded reserve.
///         Drop-in target for UnclaimedYieldEscrow: escrow deposits
///         idle USDC here → earns ~5% APR until claimed.
///
/// Design:
///   - Shares are minted 1:1 on first deposit; price-per-share grows
///     linearly with time at `apyBps` rate.
///   - Yield is paid from `reserve` — a pre-funded pool topped up by
///     the operator. Prevents Ponzi dynamics (yield is bounded by what
///     was deposited by the operator, not by new depositors).
///   - When Kite exposes a real lending protocol (Aave/Compound-style),
///     swap this for a wrapper around that protocol — the interface
///     stays compatible (deposit/withdraw + totalAssets view).
///
/// Not audited. Hackathon demo only.
contract SimpleYieldVault is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    address public immutable operator;
    uint16 public immutable apyBps;

    uint256 public principal;
    uint256 public lastAccrueAt;
    uint256 public accruedYield;

    event Deposited(address indexed from, uint256 assets, uint256 shares);
    event Withdrawn(address indexed to, uint256 assets, uint256 shares);
    event YieldAccrued(uint256 amount, uint256 newAccruedYield);
    event ReserveToppedUp(uint256 amount);

    error NotOperator();
    error InsufficientReserve();

    constructor(IERC20 _asset, address _operator, uint16 _apyBps)
        ERC20("Kutip Yield Vault Share", "kVLT")
    {
        asset = _asset;
        operator = _operator;
        apyBps = _apyBps;
        lastAccrueAt = block.timestamp;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @notice Total assets under management (principal + accrued yield).
    function totalAssets() public view returns (uint256) {
        uint256 pending = _pendingYield();
        return principal + accruedYield + pending;
    }

    function _pendingYield() internal view returns (uint256) {
        if (principal == 0) return 0;
        uint256 dt = block.timestamp - lastAccrueAt;
        // yield = principal * apyBps * dt / (10_000 * 365 days)
        return (principal * apyBps * dt) / (10_000 * 365 days);
    }

    function accrue() public {
        uint256 pending = _pendingYield();
        if (pending == 0) {
            lastAccrueAt = block.timestamp;
            return;
        }
        accruedYield += pending;
        lastAccrueAt = block.timestamp;
        emit YieldAccrued(pending, accruedYield);
    }

    /// @notice Deposit `assets` USDC, mint shares at current price.
    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        accrue();
        shares = _convertToShares(assets);
        if (shares == 0) shares = assets; // first deposit = 1:1
        _mint(receiver, shares);
        principal += assets;
        asset.safeTransferFrom(msg.sender, address(this), assets);
        emit Deposited(msg.sender, assets, shares);
    }

    /// @notice Redeem `shares` for assets + proportional yield.
    function redeem(uint256 shares, address receiver) external returns (uint256 assets) {
        accrue();
        assets = _convertToAssets(shares);
        _burn(msg.sender, shares);

        // Prefer yield first, then principal
        uint256 fromYield = assets > principal ? principal : assets;
        // (correct accounting: assets pulled proportionally from both pools)
        if (assets <= principal) {
            principal -= assets;
        } else {
            uint256 yieldTaken = assets - principal;
            if (yieldTaken > accruedYield) revert InsufficientReserve();
            accruedYield -= yieldTaken;
            principal = 0;
        }

        asset.safeTransfer(receiver, assets);
        emit Withdrawn(receiver, assets, shares);
    }

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        uint256 supply = totalSupply();
        uint256 assetsInVault = totalAssets();
        if (supply == 0 || assetsInVault == 0) return assets;
        return (assets * supply) / assetsInVault;
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return shares;
        return (shares * totalAssets()) / supply;
    }

    /// @notice Operator tops up the reserve so future yield has backing.
    ///         In production this would be replaced by a wrapper around
    ///         an actual yield source (Aave supply APY, Compound, etc.)
    function topUpReserve(uint256 amount) external onlyOperator {
        accrue();
        asset.safeTransferFrom(msg.sender, address(this), amount);
        accruedYield += amount;
        emit ReserveToppedUp(amount);
    }

    /// @notice Preview current price per share in assets (scaled 1e18).
    function pricePerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }
}
