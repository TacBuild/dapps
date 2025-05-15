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
    struct SaHooks{
        PreHook[] preHooks;
        PostHook[] postHooks;
        MainCallHook mainCallHook;
    }
    
}
