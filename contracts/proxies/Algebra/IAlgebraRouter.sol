// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    address deployer;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 limitSqrtPrice;
}

struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

struct ExactOutputSingleParams {
    address tokenIn;
    address tokenOut;
    address deployer;
    address recipient;
    uint256 deadline;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 limitSqrtPrice;
}

struct ExactOutputParams {
    bytes path;
    address recipient;
    uint256 deadline;
    uint256 amountOut;
    uint256 amountInMaximum;
}

struct SwapCallbackData {
    bytes path;
    address payer;
}



/**
 * @title IRouter Interface
 * @notice This interface defines the core functionalities for a Router in a Algebra.
 * @dev Router for stateless execution of swaps against Algebra
 */
interface IRouter {
    /**
     *@dev exactInputSingle
     */
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    
    /**
     *@dev exactInput
     */
    function exactInput(ExactInputParams memory params) external payable returns (uint256 amountOut);
    
    /**
     *@dev exactOutputSingle
     */
    function exactOutputSingle(ExactOutputSingleParams calldata params) external payable returns (uint256 amountIn);
    
    /**
     *@dev exactOutput
     */
    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256 amountIn);
}