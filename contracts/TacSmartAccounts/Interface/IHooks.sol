// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IHooks {
    struct PreHook {
        bool isFromSAPerspective;
        address contractAddress;
        uint256 value;
        bytes data;
    }

    struct PostHook {
        bool isFromSAPerspective;
        address contractAddress;
        uint256 value;
        bytes data;
    }

    struct MainCallHook {
        bool isFromSAPerspective;
        address contractAddress;
        uint256 value;
        bytes data;
    }

    struct NFTBridgeHook {
        address tokenAddress;
        uint256 tokenId;
        uint256 amount;
    }

    struct TokenBridgeHook {
        address tokenAddress;
    }

    struct BridgeHook {
        NFTBridgeHook[] nftBridgeHooks;
        TokenBridgeHook[] tokenBridgeHooks;
        bool isFromSAPerspective;
    }

    struct SaHooks{
        PreHook[] preHooks;
        PostHook[] postHooks;
        BridgeHook bridgeHooks;
        MainCallHook mainCallHook;
    }
    
}
