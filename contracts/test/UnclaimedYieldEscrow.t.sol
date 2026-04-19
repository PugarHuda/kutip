// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {UnclaimedYieldEscrow} from "../src/UnclaimedYieldEscrow.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 18; }
}

contract UnclaimedYieldEscrowTest is Test {
    UnclaimedYieldEscrow escrow;
    MockUSDC usdc;
    address operator = makeAddr("operator");
    address claimer = makeAddr("chen");
    bytes32 constant ORCID_HASH = keccak256("0000-0001-1234-0001");
    uint16 constant APY_BPS = 500; // 5%

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new UnclaimedYieldEscrow(address(usdc), operator, APY_BPS);
    }

    function test_DepositBuildsPrincipal() public {
        usdc.mint(operator, 100 ether);
        vm.startPrank(operator);
        usdc.approve(address(escrow), 100 ether);
        escrow.depositFor(ORCID_HASH, 40 ether);
        escrow.depositFor(ORCID_HASH, 60 ether);
        vm.stopPrank();

        (uint256 principal,,,) = escrow.deposits(ORCID_HASH);
        assertEq(principal, 100 ether);
        assertEq(escrow.totalPrincipalOutstanding(), 100 ether);
    }

    function test_AccruedYieldAfterOneYear() public {
        usdc.mint(operator, 100 ether);
        vm.startPrank(operator);
        usdc.approve(address(escrow), 100 ether);
        escrow.depositFor(ORCID_HASH, 100 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        uint256 y = escrow.accruedYield(ORCID_HASH);
        // 100 * 5% = 5 USDC (allow 1 wei rounding)
        assertApproxEqAbs(y, 5 ether, 1);
    }

    function test_ClaimTransfersPrincipalAndYield() public {
        usdc.mint(operator, 200 ether);
        vm.startPrank(operator);
        usdc.approve(address(escrow), 100 ether);
        escrow.depositFor(ORCID_HASH, 100 ether);
        // operator also approves yield top-up
        usdc.approve(address(escrow), 10 ether);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        vm.prank(operator);
        escrow.claim(ORCID_HASH, claimer);

        // claimer received 100 principal + 5 yield
        assertEq(usdc.balanceOf(claimer), 105 ether);
        assertEq(escrow.totalPrincipalOutstanding(), 0);
    }

    function test_RevertOnDoubleClaim() public {
        usdc.mint(operator, 200 ether);
        vm.startPrank(operator);
        usdc.approve(address(escrow), 200 ether);
        escrow.depositFor(ORCID_HASH, 10 ether);
        escrow.claim(ORCID_HASH, claimer);
        vm.expectRevert(UnclaimedYieldEscrow.AlreadyClaimed.selector);
        escrow.claim(ORCID_HASH, claimer);
        vm.stopPrank();
    }

    function test_RevertOnMissingDeposit() public {
        vm.prank(operator);
        vm.expectRevert(UnclaimedYieldEscrow.NotFound.selector);
        escrow.claim(ORCID_HASH, claimer);
    }

    function test_OnlyOperatorCanDeposit() public {
        vm.expectRevert(UnclaimedYieldEscrow.NotOperator.selector);
        escrow.depositFor(ORCID_HASH, 1 ether);
    }

    function test_RegisterDepositWithoutTransfer() public {
        // Simulate AttributionLedger pre-sending funds to escrow directly.
        usdc.mint(address(escrow), 40 ether);

        vm.prank(operator);
        escrow.registerDeposit(ORCID_HASH, 40 ether);

        (uint256 principal,,,) = escrow.deposits(ORCID_HASH);
        assertEq(principal, 40 ether);
        assertEq(escrow.totalPrincipalOutstanding(), 40 ether);

        // Claimer gets what was registered, plus yield from operator top-up
        usdc.mint(operator, 5 ether);
        vm.prank(operator);
        usdc.approve(address(escrow), 5 ether);
        vm.warp(block.timestamp + 365 days);
        vm.prank(operator);
        escrow.claim(ORCID_HASH, claimer);
        // 40 principal + 2 yield (5% of 40)
        assertEq(usdc.balanceOf(claimer), 42 ether);
    }

    function test_YieldFundingTrackedByEvent() public {
        usdc.mint(address(this), 50 ether);
        usdc.approve(address(escrow), 50 ether);
        vm.expectEmit(true, false, false, true);
        emit UnclaimedYieldEscrow.YieldFunded(address(this), 25 ether);
        escrow.fundYield(25 ether);
    }
}
