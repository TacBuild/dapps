// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TestToken} from "./TestToken.sol";


contract VaultMock {

    
    address private _mToken;
    uint256 private _requestCounter;

    struct DepositRequest {
        address user;
        address tokenIn;
        uint256 amountToken;
        bytes32 referrerId;
        bool processed;
    }

    struct RedeemRequest {
        address user;
        address tokenOut;
        uint256 amountMToken;
        bool processed;
    }

    mapping(uint256 => DepositRequest) public depositRequests;
    mapping(uint256 => RedeemRequest) public redeemRequests;


    event DepositInstant(address indexed user, address indexed tokenIn, uint256 amountToken, uint256 mTokenMinted, bytes32 referrerId);
    event DepositRequestCreated(uint256 indexed requestId, address indexed user, address indexed tokenIn, uint256 amountToken, bytes32 referrerId);

    event RedeemInstant(address indexed user, address indexed tokenOut, uint256 amountMToken, uint256 feeAmount, uint256 amountTokenOut);
    event RedeemRequestCreated(uint256 indexed requestId, address indexed user, address indexed tokenOut, uint256 amountMToken);


    constructor(address initialMToken) {
        _mToken = initialMToken;
    }


    function setMToken(address newMToken) external {
        _mToken = newMToken;
    }

    function mToken() external view returns (address) {
        return _mToken;
    }

    function requestCount() external view returns (uint256) {
        return _requestCounter;
    }

 
    function depositInstant(
        address tokenIn,
        uint256 amountToken,
        uint256 minReceiveAmount,
        bytes32 referrerId
    ) external {

        require(amountToken > 0, "Amount must be > 0");

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountToken), "Transfer failed");


        
        require(_mToken != address(0), "mToken address not set");

        TestToken(_mToken).mint(msg.sender, amountToken);


        require(amountToken >= minReceiveAmount, "Slippage too high");

        emit DepositInstant(msg.sender, tokenIn, amountToken, amountToken, referrerId);
    }


    function depositRequest(
        address tokenIn,
        uint256 amountToken,
        bytes32 referrerId
    ) external returns (uint256) {
        require(amountToken > 0, "Amount must be > 0");

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountToken), "Transfer failed");

        _requestCounter++;
        depositRequests[_requestCounter] = DepositRequest({
            user: msg.sender,
            tokenIn: tokenIn,
            amountToken: amountToken,
            referrerId: referrerId,
            processed: false
        });

        emit DepositRequestCreated(_requestCounter, msg.sender, tokenIn, amountToken, referrerId);
        return _requestCounter;
    }

    

    function redeemInstant(
        address tokenOut,
        uint256 amountMTokenIn,
        uint256 minReceiveAmount
    ) external returns (uint256) {
        require(amountMTokenIn > 0, "Amount must be > 0");


        require(_mToken != address(0), "mToken address not set");

        TestToken(_mToken).burn(msg.sender, amountMTokenIn);

        require(amountMTokenIn >= minReceiveAmount, "Slippage too high");

        IERC20(tokenOut).transfer(msg.sender, amountMTokenIn);

        emit RedeemInstant(msg.sender, tokenOut, amountMTokenIn, 0, amountMTokenIn);

        return amountMTokenIn;
    }


    function redeemRequest(
        address tokenOut,
        uint256 amountMTokenIn
    ) external returns (uint256) {
        require(amountMTokenIn > 0, "Amount must be > 0");

        
        require(_mToken != address(0), "mToken address not set");

        // Передача mToken контракту (депозит)
        require(TestToken(_mToken).transferFrom(msg.sender, address(this), amountMTokenIn), "Transfer failed");

        _requestCounter++;
        redeemRequests[_requestCounter] = RedeemRequest({
            user: msg.sender,
            tokenOut: tokenOut,
            amountMToken: amountMTokenIn,
            processed: false
        });

        emit RedeemRequestCreated(_requestCounter, msg.sender, tokenOut, amountMTokenIn);

        return _requestCounter;
    }
}

