// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyMarket} from "../src/BountyMarket.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 18; }
}

contract BountyMarketTest is Test {
    BountyMarket market;
    MockUSDC usdc;

    address operator = makeAddr("operator");
    address sponsor = makeAddr("sponsor");
    address authorA = makeAddr("authorA");
    address authorB = makeAddr("authorB");

    bytes32 constant TOPIC = keccak256("carbon capture");
    bytes32 constant QUERY = keccak256("q-1");

    function setUp() public {
        usdc = new MockUSDC();
        market = new BountyMarket(address(usdc), operator);
    }

    function _fundSponsor(uint256 amount) internal {
        usdc.mint(sponsor, amount);
        vm.prank(sponsor);
        usdc.approve(address(market), amount);
    }

    function test_CreateBountyPullsFunds() public {
        _fundSponsor(5 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 5 ether, 7 days);
        assertEq(id, 0);
        assertEq(usdc.balanceOf(address(market)), 5 ether);
    }

    function test_SettleSplitsByWeight() public {
        _fundSponsor(10 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 10 ether, 7 days);

        address[] memory authors = new address[](2);
        authors[0] = authorA;
        authors[1] = authorB;
        uint16[] memory w = new uint16[](2);
        w[0] = 6000;
        w[1] = 4000;

        vm.prank(operator);
        market.settle(id, QUERY, authors, w);

        assertEq(usdc.balanceOf(authorA), 6 ether);
        assertEq(usdc.balanceOf(authorB), 4 ether);
        assertEq(usdc.balanceOf(address(market)), 0);
    }

    function test_RefundAfterExpiry() public {
        _fundSponsor(3 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 3 ether, 1 days);

        vm.warp(block.timestamp + 2 days);
        vm.prank(sponsor);
        market.refund(id);

        assertEq(usdc.balanceOf(sponsor), 3 ether);
    }

    function test_RevertRefundBeforeExpiry() public {
        _fundSponsor(2 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 2 ether, 10 days);
        vm.expectRevert(BountyMarket.NotYetExpired.selector);
        vm.prank(sponsor);
        market.refund(id);
    }

    function test_RevertSettleWithBadWeights() public {
        _fundSponsor(1 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 1 ether, 7 days);

        address[] memory authors = new address[](1);
        authors[0] = authorA;
        uint16[] memory w = new uint16[](1);
        w[0] = 9999;

        vm.prank(operator);
        vm.expectRevert(BountyMarket.WeightSumInvalid.selector);
        market.settle(id, QUERY, authors, w);
    }

    function test_IsActiveReflectsState() public {
        _fundSponsor(1 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 1 ether, 1 days);
        assertTrue(market.isActive(id));

        vm.warp(block.timestamp + 2 days);
        assertFalse(market.isActive(id));
    }

    function test_RevertSettleFromNonOperator() public {
        _fundSponsor(1 ether);
        vm.prank(sponsor);
        uint256 id = market.create(TOPIC, 1 ether, 7 days);

        address[] memory authors = new address[](1);
        authors[0] = authorA;
        uint16[] memory w = new uint16[](1);
        w[0] = 10000;

        vm.expectRevert(BountyMarket.NotOperator.selector);
        market.settle(id, QUERY, authors, w);
    }
}
