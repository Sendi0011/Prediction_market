// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {MarketFactory} from "../src/MarketFactory.sol";
import {Market} from "../src/Market.sol";
import {MarketTypes} from "../src/MarketTypes.sol";
import {AIOracle} from "../src/AIOracle.sol";
import {Test, console} from "forge-std/Test.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol"; // Using a mock ERC20 for USDC

contract MarketFactoryTest is Test {
    MarketFactory public factory;
    ERC20Mock public usdc;
    AIOracle public aiOracle;
    address public deployer;
    address public admin;
    address public creator1;
    address public creator2;
    address public treasury;
    address public marketImplementation;

    function setUp() public {
        deployer = vm.addr(0x100);
        admin = vm.addr(0x200);
        creator1 = vm.addr(0x300);
        creator2 = vm.addr(0x301);
        treasury = vm.addr(0x400);

        vm.startPrank(deployer);
        usdc = new ERC20Mock("USD Coin", "USDC");

        address[] memory initialSigners = new address[](1);
        initialSigners[0] = vm.addr(0x500); // Placeholder signer
        aiOracle = new AIOracle(initialSigners, admin);

        // Deploy a dummy Market contract to use as implementation
        marketImplementation = address(new Market());
        vm.stopPrank();

        vm.startPrank(admin);
        factory = new MarketFactory(address(usdc), address(aiOracle), treasury, marketImplementation, admin);
        // Grant creator1 CREATOR_ROLE for testing
        factory.grantRole(factory.CREATOR_ROLE(), creator1);
        vm.stopPrank();
    }

    function testConstructor() public {
        assertEq(address(factory.usdc()), address(usdc));
        assertEq(address(factory.aiOracle()), address(aiOracle));
        assertEq(factory.treasury(), treasury);
        assertEq(factory.marketImplementation(), marketImplementation);

        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(factory.hasRole(factory.ADMIN_ROLE(), admin));
        assertTrue(factory.hasRole(factory.CREATOR_ROLE(), admin));
        assertTrue(factory.hasRole(factory.CREATOR_ROLE(), creator1));

        // Test constructor reverts
        vm.expectRevert("ZeroAddress()");
        new MarketFactory(address(0), address(aiOracle), treasury, marketImplementation, admin);

        vm.expectRevert("ZeroAddress()");
        new MarketFactory(address(usdc), address(0), treasury, marketImplementation, admin);

        vm.expectRevert("ZeroAddress()");
        new MarketFactory(address(usdc), address(aiOracle), address(0), marketImplementation, admin);
    }

    function testCreateMarket_Success_DefaultParams() public {
        vm.startPrank(creator1);
        uint256 endsAt = block.timestamp + 2 days;
        (address marketAddress, bytes32 marketId) = factory.createMarket(
            "Will BTC hit $100k by Jan 2025?",
            "Crypto",
            new string[](0),
            endsAt,
            0,
            0,
            0
        );
        vm.stopPrank();

        assertTrue(marketAddress != address(0));
        assertEq(factory.getMarket(marketId), marketAddress);
        assertTrue(factory.isMarket(marketAddress));
        assertEq(factory.allMarkets(0), marketAddress);
        assertEq(factory.creatorMarkets(creator1)[0], marketId);
        assertEq(factory.categoryMarkets("Crypto")[0], marketId);
        assertEq(factory.totalMarketsCreated(), 1);

        // Check if market was initialized correctly
        Market newMarket = Market(marketAddress);
        assertEq(address(newMarket.usdc()), address(usdc));
        assertEq(address(newMarket.aiOracle()), address(aiOracle));
        assertEq(newMarket.marketConfig().endsAt, endsAt);
        assertEq(newMarket.marketConfig().feeBP, factory.defaultFeeBP());
        assertEq(newMarket.marketConfig().maxStakePerUser, factory.defaultMaxStakePerUser());
        assertEq(newMarket.marketConfig().maxTotalPool(), factory.defaultMaxTotalPool());
        assertEq(newMarket.marketMetadata().question, "Will BTC hit $100k by Jan 2025?");
        assertEq(newMarket.marketMetadata().creator, creator1);
        assertEq(newMarket.getTreasury(), treasury);
    }

    function testCreateMarket_Success_CustomParams() public {
        vm.startPrank(creator1);
        uint224 customFeeBP = 100; // 1%
        uint256 customMaxStake = 500 * 1e6;
        uint256 customMaxPool = 5000 * 1e6;
        uint256 endsAt = block.timestamp + 3 days;

        (address marketAddress, bytes32 marketId) = factory.createMarket(
            "Will ETH hit $10k by Feb 2025?",
            "Crypto",
            new string[](0),
            endsAt,
            customFeeBP,
            customMaxStake,
            customMaxPool
        );
        vm.stopPrank();

        assertTrue(marketAddress != address(0));
        Market newMarket = Market(marketAddress);
        assertEq(newMarket.marketConfig().feeBP, customFeeBP);
        assertEq(newMarket.marketConfig().maxStakePerUser, customMaxStake);
        assertEq(newMarket.marketConfig().maxTotalPool(), customMaxPool);
    }

    function testCreateMarket_Reverts() public {
        uint256 endsAt = block.timestamp + 2 days;
        string memory question = "Q";
        string memory category = "Cat";
        string[] memory sources = new string[](0);

        // Test InvalidDuration - too short
        vm.expectRevert("InvalidDuration()");
        vm.startPrank(creator1);
        factory.createMarket(question, category, sources, block.timestamp + factory.minMarketDuration() - 1, 0, 0, 0);
        vm.stopPrank();

        // Test InvalidDuration - too long
        vm.expectRevert("InvalidDuration()");
        vm.startPrank(creator1);
        factory.createMarket(question, category, sources, block.timestamp + factory.maxMarketDuration() + 1, 0, 0, 0);
        vm.stopPrank();

        // Test onlyRole(CREATOR_ROLE)
        vm.expectRevert(); // Default error for unauthorized access in AccessControl
        vm.startPrank(deployer); // deployer does not have CREATOR_ROLE
        factory.createMarket(question, category, sources, endsAt, 0, 0, 0);
        vm.stopPrank();

        // Test MarketAlreadyExists - by creating the same market twice
        vm.startPrank(creator1);
        factory.createMarket(question, category, sources, endsAt, 0, 0, 0);
        vm.expectRevert("MarketAlreadyExists()");
        factory.createMarket(question, category, sources, endsAt, 0, 0, 0);
        vm.stopPrank();

        // Test InvalidParameters - feeBP too high
        vm.expectRevert("InvalidParameters()");
        vm.startPrank(creator1);
        factory.createMarket(question, category, sources, endsAt, 1001, 0, 0);
        vm.stopPrank();
    }

    function testCreateSimpleMarket() public {
        vm.startPrank(creator1);
        uint256 endsAt = block.timestamp + 4 days;
        (address marketAddress, bytes32 marketId) = factory.createSimpleMarket(
            "Simple Question?",
            "Simple",
            endsAt
        );
        vm.stopPrank();

        assertTrue(marketAddress != address(0));
        Market newMarket = Market(marketAddress);
        assertEq(newMarket.marketConfig().feeBP, factory.defaultFeeBP());
        assertEq(newMarket.marketConfig().maxStakePerUser, factory.defaultMaxStakePerUser());
        assertEq(newMarket.marketConfig().maxTotalPool(), factory.defaultMaxTotalPool());
        assertEq(newMarket.marketMetadata().question, "Simple Question?");
    }

    function testUpdateMarketImplementation() public {
        address newImpl = vm.addr(0x600);
        vm.startPrank(admin);
        factory.updateMarketImplementation(newImpl);
        vm.stopPrank();

        assertEq(factory.marketImplementation(), newImpl);

        vm.expectRevert("ZeroAddress()");
        vm.startPrank(admin);
        factory.updateMarketImplementation(address(0));
        vm.stopPrank();

        vm.expectRevert(); // Unauthorized
        vm.startPrank(creator1);
        factory.updateMarketImplementation(newImpl);
        vm.stopPrank();
    }

    function testUpdateTreasury() public {
        address newTreasury = vm.addr(0x700);
        vm.startPrank(admin);
        factory.updateTreasury(newTreasury);
        vm.stopPrank();

        assertEq(factory.treasury(), newTreasury);

        vm.expectRevert("ZeroAddress()");
        vm.startPrank(admin);
        factory.updateTreasury(address(0));
        vm.stopPrank();

        vm.expectRevert(); // Unauthorized
        vm.startPrank(creator1);
        factory.updateTreasury(newTreasury);
        vm.stopPrank();
    }

    function testUpdateDefaults() public {
        uint16 newFeeBP = 150;
        uint256 newMaxStake = 200 * 1e6;
        uint256 newMaxPool = 2000 * 1e6;

        vm.startPrank(admin);
        factory.updateDefaults(newFeeBP, newMaxStake, newMaxPool);
        vm.stopPrank();

        assertEq(factory.defaultFeeBP(), newFeeBP);
        assertEq(factory.defaultMaxStakePerUser(), newMaxStake);
        assertEq(factory.defaultMaxTotalPool(), newMaxPool);

        vm.expectRevert("InvalidParameters()"); // feeBP too high
        vm.startPrank(admin);
        factory.updateDefaults(1001, newMaxStake, newMaxPool);
        vm.stopPrank();

        vm.expectRevert(); // Unauthorized
        vm.startPrank(creator1);
        factory.updateDefaults(newFeeBP, newMaxStake, newMaxPool);
        vm.stopPrank();
    }

    function testUpdateDurationLimits() public {
        uint256 newMin = 2 hours;
        uint256 newMax = 100 days;

        vm.startPrank(admin);
        factory.updateDurationLimits(newMin, newMax);
        vm.stopPrank();

        assertEq(factory.minMarketDuration(), newMin);
        assertEq(factory.maxMarketDuration(), newMax);

        vm.expectRevert("InvalidParameters()"); // newMin >= newMax
        vm.startPrank(admin);
        factory.updateDurationLimits(newMax, newMin);
        vm.stopPrank();

        vm.expectRevert(); // Unauthorized
        vm.startPrank(creator1);
        factory.updateDurationLimits(newMin, newMax);
        vm.stopPrank();
    }

    function testRoleManagement() public {
        // Add Creator
        assertFalse(factory.hasRole(factory.CREATOR_ROLE(), creator2));
        vm.startPrank(admin);
        factory.addCreator(creator2);
        vm.stopPrank();
        assertTrue(factory.hasRole(factory.CREATOR_ROLE(), creator2));

        // Remove Creator
        vm.startPrank(admin);
        factory.removeCreator(creator2);
        vm.stopPrank();
        assertFalse(factory.hasRole(factory.CREATOR_ROLE(), creator2));

        vm.expectRevert(); // Unauthorized
        vm.startPrank(creator1);
        factory.addCreator(creator2);
        vm.stopPrank();
    }

    function testGetters() public {
        // Create a market to populate data
        vm.startPrank(creator1);
        uint256 endsAt1 = block.timestamp + 2 days;
        (address marketAddress1, bytes32 marketId1) = factory.createMarket(
            "Q1", "CategoryA", new string[](0), endsAt1, 0, 0, 0
        );
        uint256 endsAt2 = block.timestamp + 3 days;
        (address marketAddress2, bytes32 marketId2) = factory.createMarket(
            "Q2", "CategoryB", new string[](0), endsAt2, 0, 0, 0
        );
        vm.stopPrank();

        assertEq(factory.getTotalMarkets(), 2);
        assertTrue(factory.verifyMarket(marketAddress1));
        assertFalse(factory.verifyMarket(address(0)));

        bytes32[] memory creator1Markets = factory.getCreatorMarkets(creator1);
        assertEq(creator1Markets.length, 2);
        assertEq(creator1Markets[0], marketId1);
        assertEq(creator1Markets[1], marketId2);

        bytes32[] memory categoryAMarkets = factory.getCategoryMarkets("CategoryA");
        assertEq(categoryAMarkets.length, 1);
        assertEq(categoryAMarkets[0], marketId1);

        assertEq(factory.getMarket(marketId1), marketAddress1);

        (uint256 totalMarkets, uint256 totalVolume, uint256 avgFee, address treasuryAddr) = factory.getStatistics();
        assertEq(totalMarkets, 2);
        assertEq(totalVolume, 0); // No volume yet
        assertEq(avgFee, factory.defaultFeeBP());
        assertEq(treasuryAddr, treasury);

        // Test getAllMarkets
        address[] memory allMarkets = factory.getAllMarkets(0, 2);
        assertEq(allMarkets.length, 2);
        assertEq(allMarkets[0], marketAddress1);
        assertEq(allMarkets[1], marketAddress2);

        allMarkets = factory.getAllMarkets(0, 1);
        assertEq(allMarkets.length, 1);
        assertEq(allMarkets[0], marketAddress1);

        allMarkets = factory.getAllMarkets(1, 1);
        assertEq(allMarkets.length, 1);
        assertEq(allMarkets[0], marketAddress2);

        allMarkets = factory.getAllMarkets(0, 10); // Limit greater than total
        assertEq(allMarkets.length, 2);
    }
}
