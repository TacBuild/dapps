pragma solidity ^0.8.25;


import { TransferHelper } from 'contracts/Helpers/TransferHelper.sol';
import { AppProxy } from "contracts/L2/AppProxy.sol";
import { ICrossChainLayer } from "contracts/interfaces/ICrossChainLayer.sol";


interface CurveLiteRouter {
    function exchange(
        address[11] calldata _route,
        uint256[4][5] calldata _swap_params,
        uint256 _amount,
        uint256 _min_dy,
        address _receiver
    ) external payable returns (uint256);
}

contract CurveLiteProxy is AppProxy {
    // State variables
    CurveLiteRouter private _router;

    /**
     * @dev Constructor function to initialize the contract with initial state.
     * @param appAddress_ Application address.
     * @param crossChainLayerAddress The Cross-Chain layer address.
     */
    
    constructor(address appAddress_, address crossChainLayerAddress) AppProxy(appAddress_, crossChainLayerAddress) {
        _router = CurveLiteRouter(appAddress_);
    }

    /**
     * @dev Proxy function to perform token exchange using the Curve Lite Router.
     * @param route Array of addresses for the route.
     * @param swapParams 2D array of uint256 for swap parameters.
     * @param amount Amount of tokens to be swapped.
     * @param minDy Minimum amount of tokens to receive.
     */
    function exchange(
        address[11] calldata route,
        uint256[4][5] calldata swapParams,
        uint256 amount,
        uint256 minDy
    ) public onlyCrossChainLayer {
        require(msg.sender != address(0), "Invalid receiver address");

        // Grant token approval
        TransferHelper.safeApprove(route[0], address(_router), amount);

        // Perform the token exchange
        uint256 receivedAmount = _router.exchange(route, swapParams, amount, minDy, msg.sender);

    }
}



