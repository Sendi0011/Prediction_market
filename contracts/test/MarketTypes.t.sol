// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {MarketTypes} from "../src/MarketTypes.sol";
import {Test} from "forge-std/Test.sol";

contract MarketTypesTest is Test {
    function setUp() public {}

    function testMarketParametersStruct() public {
        MarketTypes.MarketParameters memory params = MarketTypes.MarketParameters({
            openingTime: 1,
            closingTime: 100,
            oracleWithdrawAllowance: 10,
            tokenWithdrawAllowance: 5,
            disputeTime: 50,
            marketQuestion: "Test Question",
            marketSalt: 123
        });

        assertEq(params.openingTime, 1);
        assertEq(params.closingTime, 100);
        assertEq(params.oracleWithdrawAllowance, 10);
        assertEq(params.tokenWithdrawAllowance, 5);
        assertEq(params.disputeTime, 50);
        assertEq(params.marketQuestion, "Test Question");
        assertEq(params.marketSalt, 123);
    }

    function testMarketTermsStruct() public {
        MarketTypes.MarketTerms memory terms = MarketTypes.MarketTerms({
            payouts: new uint256[](2),
            isFinalized: false
        });

        assertEq(terms.isFinalized, false);
        assertEq(terms.payouts.length, 2);
    }

    function testOutcomeStruct() public {
        MarketTypes.Outcome memory outcome = MarketTypes.Outcome({
            outcomeId: 0,
            winningTokens: 0,
            losingTokens: 0
        });

        assertEq(outcome.outcomeId, 0);
        assertEq(outcome.winningTokens, 0);
        assertEq(outcome.losingTokens, 0);
    }
}
