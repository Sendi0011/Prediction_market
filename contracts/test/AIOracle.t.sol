// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AIOracle} from "../src/AIOracle.sol";
import {MarketTypes} from "../src/MarketTypes.sol";
import {Test, console} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract AIOracleTest is Test {
    AIOracle public oracle;
    address public deployer;
    address public admin;
    address public signer1;
    address public signer2;
    address public signer3;
    address public signer4; // Additional signer for testing removal
    address public nonSigner;

    // Private keys for signing
    uint256 privateKey1 = 0x111;
    uint256 privateKey2 = 0x222;
    uint256 privateKey3 = 0x333;

    bytes32 public constant MARKET_ID = keccak256("testMarket");

    function setUp() public {
        deployer = vm.addr(0x100);
        admin = vm.addr(0x200);
        signer1 = vm.addr(privateKey1);
        signer2 = vm.addr(privateKey2);
        signer3 = vm.addr(privateKey3);
        signer4 = vm.addr(0x400); // For testing signer removal
        nonSigner = vm.addr(0x500);

        address[] memory initialSigners = new address[](3);
        initialSigners[0] = signer1;
        initialSigners[1] = signer2;
        initialSigners[2] = signer3;

        vm.startPrank(deployer);
        oracle = new AIOracle(initialSigners, admin);
        vm.stopPrank();
    }

    // Helper function to sign a message
    function _signResolution(
        uint256 privateKey,
        bytes32 marketId,
        MarketTypes.Side result,
        uint256 timestamp,
        uint256 nonce
    ) internal view returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                address(oracle),
                marketId,
                uint8(result),
                timestamp,
                nonce
            )
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    function testConstructor() public {
        assertEq(oracle.signerCount(), 3);
        assertTrue(oracle.authorizedSigners(signer1));
        assertTrue(oracle.authorizedSigners(signer2));
        assertTrue(oracle.authorizedSigners(signer3));
        assertFalse(oracle.authorizedSigners(signer4)); // Should not be an initial signer

        assertTrue(oracle.hasRole(oracle.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.ADMIN_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.RESOLVER_ROLE(), admin));
        assertTrue(oracle.hasRole(oracle.RESOLVER_ROLE(), signer1));
        assertTrue(oracle.hasRole(oracle.RESOLVER_ROLE(), signer2));
        assertTrue(oracle.hasRole(oracle.RESOLVER_ROLE(), signer3));
    }

    function testAddSigner() public {
        vm.startPrank(admin);
        oracle.addSigner(signer4);
        vm.stopPrank();

        assertTrue(oracle.authorizedSigners(signer4));
        assertEq(oracle.signerCount(), 4);
        assertTrue(oracle.hasRole(oracle.RESOLVER_ROLE(), signer4));

        vm.expectRevert("Already signer");
        vm.startPrank(admin);
        oracle.addSigner(signer4);
        vm.stopPrank();
    }

    function testRemoveSigner() public {
        // Add signer4 first
        vm.startPrank(admin);
        oracle.addSigner(signer4);
        vm.stopPrank();

        // Now remove signer4
        vm.startPrank(admin);
        oracle.removeSigner(signer4);
        vm.stopPrank();

        assertFalse(oracle.authorizedSigners(signer4));
        assertEq(oracle.signerCount(), 3);
        assertFalse(oracle.hasRole(oracle.RESOLVER_ROLE(), signer4));

        vm.expectRevert("Not a signer");
        vm.startPrank(admin);
        oracle.removeSigner(signer4);
        vm.stopPrank();

        vm.expectRevert("Cannot remove, would break consensus");
        vm.startPrank(admin);
        oracle.removeSigner(signer1); // Removing would make signerCount 2, which is < REQUIRED_CONFIRMATIONS (3)
        vm.stopPrank();
    }

    function testSubmitResolution_Success() public {
        uint256 timestamp = block.timestamp;
        uint256 nonce = 1;
        MarketTypes.Side result = MarketTypes.Side.Yes;

        // Signer 1 submits
        bytes memory sig1 = _signResolution(privateKey1, MARKET_ID, result, timestamp, nonce);
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig1);
        vm.stopPrank();
        assertEq(oracle.voteCount(MARKET_ID, result), 1);
        assertEq(oracle.resolutionVotes(MARKET_ID, signer1), result);

        // Signer 2 submits
        nonce++;
        bytes memory sig2 = _signResolution(privateKey2, MARKET_ID, result, timestamp, nonce);
        vm.startPrank(signer2);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig2);
        vm.stopPrank();
        assertEq(oracle.voteCount(MARKET_ID, result), 2);
        assertEq(oracle.resolutionVotes(MARKET_ID, signer2), result);

        // Signer 3 submits - should propose resolution
        nonce++;
        bytes memory sig3 = _signResolution(privateKey3, MARKET_ID, result, timestamp, nonce);
        vm.startPrank(signer3);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig3);
        vm.stopPrank();
        assertEq(oracle.voteCount(MARKET_ID, result), 3);
        assertEq(oracle.resolutionVotes(MARKET_ID, signer3), result);

        // Check proposed resolution
        MarketTypes.Resolution memory proposed = oracle.proposedResolutions(MARKET_ID);
        assertEq(uint8(proposed.result), uint8(result));
        assertEq(proposed.proposer, signer3);
        assertTrue(proposed.challengeDeadline > block.timestamp);
        assertFalse(proposed.challenged);
    }

    function testSubmitResolution_Reverts() public {
        uint256 timestamp = block.timestamp;
        uint256 nonce = 1;
        MarketTypes.Side result = MarketTypes.Side.Yes;

        // Test InvalidSignature (tampered signature)
        bytes memory tamperedSig = _signResolution(privateKey1, MARKET_ID, MarketTypes.Side.No, timestamp, nonce);
        vm.expectRevert("InvalidSignature()");
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, tamperedSig);
        vm.stopPrank();

        // Test NonceAlreadyUsed
        bytes memory sig1 = _signResolution(privateKey1, MARKET_ID, result, timestamp, nonce);
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig1);
        vm.stopPrank();

        vm.expectRevert("NonceAlreadyUsed()");
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig1);
        vm.stopPrank();

        // Test NotAuthorizedResolver
        nonce++;
        bytes memory sigNonSigner = _signResolution(nonSigner, MARKET_ID, result, timestamp, nonce);
        vm.expectRevert("NotAuthorizedResolver()");
        vm.startPrank(nonSigner);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sigNonSigner);
        vm.stopPrank();

        // Test SignatureExpired (future timestamp)
        nonce++;
        vm.expectRevert("SignatureExpired()");
        bytes memory sigExpiredFuture = _signResolution(privateKey1, MARKET_ID, result, block.timestamp + 100, nonce);
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, block.timestamp + 100, nonce, sigExpiredFuture);
        vm.stopPrank();

        // Test SignatureTooOld (past timestamp beyond MAX_SIGNATURE_AGE)
        nonce++;
        vm.expectRevert("SignatureTooOld()");
        bytes memory sigTooOld = _signResolution(privateKey1, MARKET_ID, result, block.timestamp - oracle.MAX_SIGNATURE_AGE() - 1, nonce);
        vm.startPrank(signer1);
        oracle.submitResolution(MARKET_ID, result, block.timestamp - oracle.MAX_SIGNATURE_AGE() - 1, nonce, sigTooOld);
        vm.stopPrank();

        // Test AlreadyVoted
        nonce++;
        bytes memory sig2 = _signResolution(privateKey2, MARKET_ID, result, timestamp, nonce);
        vm.startPrank(signer2);
        oracle.submitResolution(MARKET_ID, result, timestamp, nonce, sig2);
        vm.stopPrank();

        vm.expectRevert("AlreadyVoted()");
        vm.startPrank(signer2);
        oracle.submitResolution(MARKET_ID, MarketTypes.Side.No, timestamp, nonce, sig2); // Try to vote again with different result
        vm.stopPrank();
    }

    function testFinalizeResolution_Success() public {
        // First, propose a resolution
        testSubmitResolution_Success(); // This will propose a resolution with Yes

        // Fast forward beyond challenge period
        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() + 1);

        vm.startPrank(admin); // Anyone can call finalizeResolution, but admin is safe
        oracle.finalizeResolution(MARKET_ID);
        vm.stopPrank();

        assertTrue(oracle.isResolutionFinalized(MARKET_ID));
        assertEq(uint8(oracle.getResolution(MARKET_ID)), uint8(MarketTypes.Side.Yes));
    }

    function testFinalizeResolution_Reverts() public {
        // Attempt to finalize without any resolution proposed
        vm.expectRevert("InvalidResult()"); // result == MarketTypes.Side.None
        vm.startPrank(admin);
        oracle.finalizeResolution(MARKET_ID);
        vm.stopPrank();

        // Propose a resolution
        testSubmitResolution_Success();

        // Attempt to finalize within challenge period
        vm.expectRevert("ChallengeWindowActive()");
        vm.startPrank(admin);
        oracle.finalizeResolution(MARKET_ID);
        vm.stopPrank();

        // Fast forward and challenge
        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() / 2);
        vm.startPrank(nonSigner); // Anyone can challenge
        oracle.challengeResolution(MARKET_ID, "Incorrect resolution");
        vm.stopPrank();

        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() + 1);

        // Attempt to finalize a challenged resolution
        vm.expectRevert("Resolution disputed");
        vm.startPrank(admin);
        oracle.finalizeResolution(MARKET_ID);
        vm.stopPrank();
    }

    function testChallengeResolution_Success() public {
        // Propose a resolution
        testSubmitResolution_Success();

        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() / 2); // Within challenge period

        vm.startPrank(nonSigner); // Anyone can challenge
        oracle.challengeResolution(MARKET_ID, "Incorrect resolution");
        vm.stopPrank();

        MarketTypes.Resolution memory proposed = oracle.proposedResolutions(MARKET_ID);
        assertTrue(proposed.challenged);
        emit ResolutionChallenged(MARKET_ID, nonSigner, "Incorrect resolution");
    }

    function testChallengeResolution_Reverts() public {
        // Attempt to challenge without any resolution proposed
        vm.expectRevert("InvalidResult()");
        vm.startPrank(nonSigner);
        oracle.challengeResolution(MARKET_ID, "No resolution");
        vm.stopPrank();

        // Propose a resolution
        testSubmitResolution_Success();

        // Attempt to challenge after challenge period
        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() + 1);
        vm.expectRevert("ChallengeWindowExpired()");
        vm.startPrank(nonSigner);
        oracle.challengeResolution(MARKET_ID, "Too late");
        vm.stopPrank();

        // Finalize resolution
        vm.startPrank(admin);
        oracle.finalizeResolution(MARKET_ID); // Already passed challenge period
        vm.stopPrank();

        // Attempt to challenge a finalized resolution
        vm.expectRevert("ResolutionAlreadyFinalized()");
        vm.startPrank(nonSigner);
        oracle.challengeResolution(MARKET_ID, "Already finalized");
        vm.stopPrank();
    }

    function testAdminResolve() public {
        MarketTypes.Side finalResult = MarketTypes.Side.No;
        vm.startPrank(admin);
        oracle.adminResolve(MARKET_ID, finalResult);
        vm.stopPrank();

        assertTrue(oracle.isResolutionFinalized(MARKET_ID));
        assertEq(uint8(oracle.getResolution(MARKET_ID)), uint8(finalResult));

        vm.expectRevert("InvalidResult()");
        vm.startPrank(admin);
        oracle.adminResolve(MARKET_ID, MarketTypes.Side.None); // Invalid result
        vm.stopPrank();
    }

    function testIsResolutionFinalizedAndGetResolution() public {
        assertFalse(oracle.isResolutionFinalized(MARKET_ID));

        vm.expectRevert("Not finalized");
        oracle.getResolution(MARKET_ID);

        // Propose and finalize a resolution
        testSubmitResolution_Success();
        vm.warp(block.timestamp + oracle.CHALLENGE_PERIOD() + 1);
        vm.startPrank(admin);
        oracle.finalizeResolution(MARKET_ID);
        vm.stopPrank();

        assertTrue(oracle.isResolutionFinalized(MARKET_ID));
        assertEq(uint8(oracle.getResolution(MARKET_ID)), uint8(MarketTypes.Side.Yes));
    }
}
