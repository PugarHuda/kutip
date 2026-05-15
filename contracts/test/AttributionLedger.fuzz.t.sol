// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttributionLedger} from "../src/AttributionLedger.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) {
        return 18; // matches Kite Test USD
    }
}

/**
 * Fuzz suite for AttributionLedger.attestAndSplit.
 * Catches arithmetic edge cases that hand-written tests miss:
 *   - Tiny payments (dust)
 *   - Weights summing to exactly 10000 across all author counts
 *   - Bps math precision under odd splits
 */
contract AttributionLedgerFuzzTest is Test {
    AttributionLedger ledger;
    MockUSDC usdc;
    address operator = makeAddr("operator");
    address ecosystem = makeAddr("ecosystem");
    address payer = makeAddr("payer");

    uint16 constant OPERATOR_BPS = 5000;
    uint16 constant AUTHORS_BPS = 4000;
    uint16 constant ECOSYSTEM_BPS = 1000;

    function setUp() public {
        usdc = new MockUSDC();
        ledger = new AttributionLedger(
            address(usdc), operator, ecosystem,
            OPERATOR_BPS, AUTHORS_BPS, ECOSYSTEM_BPS
        );
        // attestAndSplit is now access-controlled to the operator.
        vm.startPrank(operator);
    }

    /// Weights sum invariant: any 2-author split must succeed when weights
    /// add to exactly 10000.
    function testFuzz_TwoAuthorSplitSucceeds(
        uint256 payment,
        uint16 weightA
    ) public {
        payment = bound(payment, 1, 1e30);
        weightA = uint16(bound(weightA, 1, 9999));
        uint16 weightB = uint16(10_000 - weightA);

        usdc.mint(address(ledger), payment);

        address authorA = address(0xa11);
        address authorB = address(0xb22);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](2);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: weightA});
        cites[1] = AttributionLedger.Citation({author: authorB, weightBps: weightB});

        // Already pranking as operator from setUp.
        ledger.attestAndSplit(keccak256(abi.encode(payment, weightA)), payment, cites);

        // Operator precise
        assertEq(usdc.balanceOf(operator), (payment * OPERATOR_BPS) / 10_000);

        // Author cuts must NOT exceed authorsShare (no overpay)
        uint256 authorsPool = (payment * AUTHORS_BPS) / 10_000;
        uint256 paidA = usdc.balanceOf(authorA);
        uint256 paidB = usdc.balanceOf(authorB);
        assertLe(paidA + paidB, authorsPool, "author overpay");

        // Ecosystem now absorbs any author-side dust. Conservation:
        // ecosystem = base ecosystem share + (authorsPool - paidA - paidB).
        uint256 baseEco = payment - (payment * OPERATOR_BPS) / 10_000 - authorsPool;
        uint256 authorDust = authorsPool - paidA - paidB;
        assertEq(usdc.balanceOf(ecosystem), baseEco + authorDust, "ecosystem dust forwarding broken");
    }

    /// Conservation: total balance moved out of ledger must equal payment.
    /// With dust-forwarding, ledger ends at zero (no residual stuck).
    function testFuzz_ConservationOfFunds(uint256 payment, uint16 weightA) public {
        payment = bound(payment, 100, 1e24);
        weightA = uint16(bound(weightA, 1, 9999));
        uint16 weightB = uint16(10_000 - weightA);

        usdc.mint(address(ledger), payment);
        uint256 ledgerBefore = usdc.balanceOf(address(ledger));

        address authorA = address(0xa11);
        address authorB = address(0xb22);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](2);
        cites[0] = AttributionLedger.Citation({author: authorA, weightBps: weightA});
        cites[1] = AttributionLedger.Citation({author: authorB, weightBps: weightB});

        ledger.attestAndSplit(keccak256(abi.encode(payment, weightA, "conservation")), payment, cites);

        uint256 sumOut =
            usdc.balanceOf(operator) +
            usdc.balanceOf(ecosystem) +
            usdc.balanceOf(authorA) +
            usdc.balanceOf(authorB);
        uint256 ledgerAfter = usdc.balanceOf(address(ledger));
        // Tight conservation: every wei is accounted for. Author-side
        // truncation dust is forwarded to ecosystem, so the ledger has
        // zero balance after settlement.
        assertEq(ledgerAfter, 0, "ledger should hold no residual");
        assertEq(sumOut, ledgerBefore, "fund conservation broken");
    }

    /// Dust resistance: payment of 1 wei must not revert.
    function test_DustPayment() public {
        usdc.mint(address(ledger), 1);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: address(0xa11), weightBps: 10_000});
        // Should succeed — every cut floor-divides to 0 but no revert path exists for 0-transfers in modern OZ
        ledger.attestAndSplit(keccak256("dust"), 1, cites);
        assertEq(usdc.balanceOf(operator), 0); // 1 * 5000 / 10000 = 0 (floor)
    }

    /// Weight mismatch by 1: 9999 must revert.
    function test_RevertOn9999Weight() public {
        usdc.mint(address(ledger), 1e18);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: address(0xa11), weightBps: 9_999});
        vm.expectRevert(AttributionLedger.WeightMismatch.selector);
        ledger.attestAndSplit(keccak256("off1"), 1e18, cites);
    }

    /// Weight mismatch by 1: 10001 must revert.
    function test_RevertOn10001Weight() public {
        usdc.mint(address(ledger), 1e18);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](1);
        cites[0] = AttributionLedger.Citation({author: address(0xa11), weightBps: 10_001});
        vm.expectRevert(AttributionLedger.WeightMismatch.selector);
        ledger.attestAndSplit(keccak256("over1"), 1e18, cites);
    }

    /// Constructor invariant: bps must sum to 10000.
    function test_RevertOnInvalidSplitConstructor() public {
        vm.expectRevert(AttributionLedger.InvalidSplit.selector);
        new AttributionLedger(address(usdc), operator, ecosystem, 5000, 4000, 999); // 9999 ≠ 10000
    }

    /// Edge: zero-weight citation embedded among others — sum still 10000.
    /// Per contract, this is allowed — author just gets 0. Don't revert.
    function test_ZeroWeightCitationAllowed() public {
        usdc.mint(address(ledger), 1e18);
        AttributionLedger.Citation[] memory cites = new AttributionLedger.Citation[](2);
        cites[0] = AttributionLedger.Citation({author: address(0xa11), weightBps: 0});
        cites[1] = AttributionLedger.Citation({author: address(0xb22), weightBps: 10_000});
        ledger.attestAndSplit(keccak256("zero"), 1e18, cites);
        assertEq(usdc.balanceOf(address(0xa11)), 0);
        assertEq(usdc.balanceOf(address(0xb22)), (uint256(1e18) * AUTHORS_BPS) / 10_000);
    }
}
