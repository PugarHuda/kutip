// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UnclaimedYieldEscrow} from "../src/UnclaimedYieldEscrow.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock", "M") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/**
 * Fuzz suite for UnclaimedYieldEscrow.
 * Yield math: principal * apyBps * elapsed / (10000 * 365 days)
 * Edges that hand-tests miss:
 *   - Tiny principal (yield = 0 due to floor)
 *   - Long elapsed times (overflow risk)
 *   - apyBps = 0 (no yield)
 */
contract UnclaimedYieldEscrowFuzzTest is Test {
    UnclaimedYieldEscrow escrow;
    MockUSDC usdc;
    address operator = makeAddr("operator");
    bytes32 constant ORCID = keccak256("0009-0002-8864-0901");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new UnclaimedYieldEscrow(address(usdc), operator, 500); // 5% APY
        usdc.mint(operator, 1e30); // operator funds yield payouts
        vm.prank(operator);
        usdc.approve(address(escrow), type(uint256).max);
    }

    /// Yield grows linearly with elapsed time (no compounding).
    function testFuzz_YieldGrowsLinearly(
        uint256 principal,
        uint64 daysElapsed
    ) public {
        principal = bound(principal, 1e6, 1e24); // 1 micro to 10^6 USDC
        daysElapsed = uint64(bound(daysElapsed, 1, 365 * 5)); // up to 5y

        usdc.mint(address(escrow), principal);
        vm.prank(operator);
        escrow.depositFor(ORCID, principal);

        vm.warp(block.timestamp + uint256(daysElapsed) * 1 days);
        uint256 actual = escrow.accruedYield(ORCID);
        uint256 expected = (principal * 500 * uint256(daysElapsed) * 1 days) /
            (10_000 * 365 days);

        assertEq(actual, expected, "yield mismatch");
    }

    /// Tiny principal: principal=1 → yield=0 over 1 year (precision floor).
    function test_DustPrincipalYieldZero() public {
        usdc.mint(address(escrow), 1);
        vm.prank(operator);
        escrow.depositFor(ORCID, 1);
        vm.warp(block.timestamp + 365 days);
        // 1 * 500 * 365 days / (10000 * 365 days) = 0 (floor)
        assertEq(escrow.accruedYield(ORCID), 0);
    }

    /// 1 USDC over 1 year at 5% = 500 wei (since principal in wei).
    function test_OneTokenOneYearYield() public {
        uint256 principal = 1e18;
        usdc.mint(address(escrow), principal);
        vm.prank(operator);
        escrow.depositFor(ORCID, principal);
        vm.warp(block.timestamp + 365 days);
        // 1e18 * 500 / 10000 = 5e16 = 0.05 USDC
        assertEq(escrow.accruedYield(ORCID), 5e16);
    }

    /// After claim, accruedYield must return 0 even if more time passes.
    function test_PostClaimYieldFreezesAtZero() public {
        uint256 principal = 1e18;
        usdc.mint(address(escrow), principal);
        vm.prank(operator);
        escrow.depositFor(ORCID, principal);
        vm.warp(block.timestamp + 30 days);
        vm.prank(operator);
        escrow.claim(ORCID, makeAddr("claimer"));
        vm.warp(block.timestamp + 365 days);
        assertEq(escrow.accruedYield(ORCID), 0);
    }

    /// Cannot claim same ORCID twice.
    function test_RevertOnDoubleClaim() public {
        uint256 principal = 1e18;
        usdc.mint(address(escrow), principal);
        vm.prank(operator);
        escrow.depositFor(ORCID, principal);
        vm.prank(operator);
        escrow.claim(ORCID, makeAddr("claimer"));
        vm.prank(operator);
        vm.expectRevert(UnclaimedYieldEscrow.AlreadyClaimed.selector);
        escrow.claim(ORCID, makeAddr("claimer2"));
    }

    /// Cannot claim non-existent deposit.
    function test_RevertOnUnknownOrcid() public {
        vm.prank(operator);
        vm.expectRevert(UnclaimedYieldEscrow.NotFound.selector);
        escrow.claim(keccak256("ghost"), makeAddr("claimer"));
    }

    /// Cannot deposit zero amount.
    function test_RevertOnZeroDeposit() public {
        vm.prank(operator);
        vm.expectRevert(UnclaimedYieldEscrow.ZeroAmount.selector);
        escrow.depositFor(ORCID, 0);
    }

    /// Only operator can deposit/claim.
    function test_RevertOnNonOperatorDeposit() public {
        vm.expectRevert(UnclaimedYieldEscrow.NotOperator.selector);
        escrow.depositFor(ORCID, 100);
    }

    /// totalPrincipalOutstanding decrements on claim.
    function testFuzz_OutstandingDecrementsOnClaim(uint256 principal) public {
        principal = bound(principal, 1, 1e24);
        usdc.mint(address(escrow), principal);
        vm.prank(operator);
        escrow.depositFor(ORCID, principal);
        assertEq(escrow.totalPrincipalOutstanding(), principal);

        vm.prank(operator);
        escrow.claim(ORCID, makeAddr("claimer"));
        assertEq(escrow.totalPrincipalOutstanding(), 0);
    }
}
