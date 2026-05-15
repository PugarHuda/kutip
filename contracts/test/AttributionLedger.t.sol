// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AttributionLedger} from "../src/AttributionLedger.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract AttributionLedgerTest is Test {
    AttributionLedger ledger;
    MockUSDC usdc;

    address operator = makeAddr("operator");
    address ecosystem = makeAddr("ecosystem");
    address alice = makeAddr("alice");
    address authorA = makeAddr("authorA");
    address authorB = makeAddr("authorB");

    uint16 constant OPERATOR_BPS = 5000;
    uint16 constant AUTHORS_BPS = 4000;
    uint16 constant ECOSYSTEM_BPS = 1000;

    function setUp() public {
        usdc = new MockUSDC();
        ledger = new AttributionLedger(
            address(usdc),
            operator,
            ecosystem,
            OPERATOR_BPS,
            AUTHORS_BPS,
            ECOSYSTEM_BPS
        );
        // All attestAndSplit calls below run as the operator now that the
        // function is access-controlled.
        vm.startPrank(operator);
    }

    function test_SplitRevenueCorrectly() public {
        uint256 payment = 2_000_000; // 2 USDC
        // Pick a payment * weight pair that doesn't truncate, so dust
        // forwarding doesn't change the per-author balances we assert.
        usdc.mint(address(ledger), payment);

        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](2);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: 6000});
        cites[1] = AttributionLedger.Citation({author: authorB, weightBps: 4000});

        ledger.attestAndSplit(keccak256("q1"), payment, cites);

        assertEq(usdc.balanceOf(operator), (payment * OPERATOR_BPS) / 10_000);

        uint256 authorsPool = (payment * AUTHORS_BPS) / 10_000;
        uint256 paidA = (authorsPool * 6000) / 10_000;
        uint256 paidB = (authorsPool * 4000) / 10_000;
        uint256 authorDust = authorsPool - paidA - paidB;
        // Ecosystem now absorbs any author-side bps truncation dust.
        assertEq(
            usdc.balanceOf(ecosystem),
            (payment * ECOSYSTEM_BPS) / 10_000 + authorDust
        );
        assertEq(usdc.balanceOf(authorA), paidA);
        assertEq(usdc.balanceOf(authorB), paidB);
    }

    function test_RevertOnDuplicateQuery() public {
        uint256 payment = 1_000_000;
        usdc.mint(address(ledger), payment * 2);

        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: 10_000});

        ledger.attestAndSplit(keccak256("q1"), payment, cites);

        vm.expectRevert(AttributionLedger.QueryAlreadyAttested.selector);
        ledger.attestAndSplit(keccak256("q1"), payment, cites);
    }

    function test_RevertOnWeightMismatch() public {
        uint256 payment = 1_000_000;
        usdc.mint(address(ledger), payment);

        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: 9000});

        vm.expectRevert(AttributionLedger.WeightMismatch.selector);
        ledger.attestAndSplit(keccak256("q2"), payment, cites);
    }

    function test_RevertOnEmptyCitations() public {
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](0);
        vm.expectRevert(AttributionLedger.EmptyCitations.selector);
        ledger.attestAndSplit(keccak256("q3"), 100, cites);
    }

    function test_AuthorStatsAccumulate() public {
        uint256 payment = 1_000_000;
        usdc.mint(address(ledger), payment * 3);

        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: 10_000});

        ledger.attestAndSplit(keccak256("q1"), payment, cites);
        ledger.attestAndSplit(keccak256("q2"), payment, cites);

        assertEq(ledger.authorCitations(authorA), 2);
        uint256 expectedPerQuery = (payment * AUTHORS_BPS) / 10_000;
        assertEq(ledger.authorEarnings(authorA), expectedPerQuery * 2);
    }

    function test_RevertOnNonOperator() public {
        vm.stopPrank(); // exit setUp's operator prank
        usdc.mint(address(ledger), 1e6);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: 10_000});
        vm.prank(alice);
        vm.expectRevert(AttributionLedger.NotOperator.selector);
        ledger.attestAndSplit(keccak256("frontrun"), 1e6, cites);
    }
}
