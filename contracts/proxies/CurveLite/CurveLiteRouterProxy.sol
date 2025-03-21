// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import { ITricryptoswapPool } from "contracts/proxies/CurveLite/CurveLiteTricryptoProxy.sol";
import { ITwocryptoswapPool } from "contracts/proxies/CurveLite/CurveLiteTwocryptoProxy.sol";
import { IStableswapPool } from "contracts/proxies/CurveLite/CurveLiteStableProxy.sol";

/**
 * @title IRouter Interface
 * @notice This interface defines the core functionalities for a Router in a CurveLite.
 * @dev Provides methods to exchange tokens and get prices.
 */
interface IRouter {
    /**
     *@notice Performs up to 5 swaps in a single transaction.
     *@dev Routing and swap params must be determined off-chain. This
         functionality is designed for gas efficiency over ease-of-use.
     *@param _route Array of [initial token, pool, token, pool, token, ...]
                  The array is iterated until a pool address of 0x00, then the last
                  given token is transferred to `_receiver`
     *@param _swap_params Multidimensional array of [i, j, swap type, pool_type] where
                        i is the index of input token
                        j is the index of output token

                        The swap_type should be:
                        1. for `exchange`,
                        2. for `exchange_underlying` (stable-ng metapools),
                        3. -- legacy --
                        4. for coin -> LP token "exchange" (actually `add_liquidity`),
                        5. -- legacy --
                        6. for LP token -> coin "exchange" (actually `remove_liquidity_one_coin`)
                        7. -- legacy --
                        8. for ETH <-> WETH

                        pool_type: 10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng, 4 - llamma

     *@param _amount The amount of input token (`_route[0]`) to be sent.
     *@param _min_dy The minimum amount received after the final swap.
     *@return Received amount of the final output token.
     */
    function exchange(
        address[11] calldata _route,
        uint256[4][5] calldata _swap_params,
        uint256 _amount,
        uint256 _min_dy
    ) external returns (uint256);
    /**
     *@notice Get amount of the final output token received in an exchange
     *@dev Routing and swap params must be determined off-chain. This
         functionality is designed for gas efficiency over ease-of-use.
     *@param _route Array of [initial token, pool, token, pool, token, ...]
                  The array is iterated until a pool address of 0x00, then the last
                  given token is transferred to `_receiver`
     *@param _swap_params Multidimensional array of [i, j, swap type, pool_type] where
                        i is the index of input token
                        j is the index of output token

                        The swap_type should be:
                        1. for `exchange`,
                        2. for `exchange_underlying` (stable-ng metapools),
                        3. -- legacy --
                        4. for coin -> LP token "exchange" (actually `add_liquidity`),
                        5. -- legacy --
                        6. for LP token -> coin "exchange" (actually `remove_liquidity_one_coin`)
                        7. -- legacy --
                        8. for ETH <-> WETH

                        pool_type: 10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng, 4 - llamma

     *@param _amount The amount of input token (`_route[0]`) to be sent.
     *@return Expected amount of the final output token.
     */
    function get_dy(
        address[11] calldata _route,
        uint256[4][5] calldata _swap_params,
        uint256 _amount
    ) external view returns (uint256);
    /**
     *@notice Calculate the input amount required to receive the desired output amount
     *@dev Routing and swap params must be determined off-chain. This
         functionality is designed for gas efficiency over ease-of-use.
     *@param _route Array of [initial token, pool, token, pool, token, ...]
                  The array is iterated until a pool address of 0x00, then the last
                  given token is transferred to `_receiver`
     *@param _swap_params Multidimensional array of [i, j, swap type, pool_type] where
                        i is the index of input token
                        j is the index of output token

                        The swap_type should be:
                        1. for `exchange`,
                        2. for `exchange_underlying` (stable-ng metapools),
                        3. -- legacy --
                        4. for coin -> LP token "exchange" (actually `add_liquidity`),
                        5. -- legacy --
                        6. for LP token -> coin "exchange" (actually `remove_liquidity_one_coin`)
                        7. -- legacy --
                        8. for ETH <-> WETH

                        pool_type: 10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng, 4 - llamma

     *@param _out_amount The desired amount of output coin to receive.
     *@return Required amount of input token to send.
     */
    function get_dx(
        address[11] calldata _route,
        uint256[4][5] calldata _swap_params,
        uint256 _out_amount
    ) external view returns (uint256);
}


/**
 * @title CurveLiteRouterProxy
 * @dev Proxy contract CurveLite, working with router
 */
contract CurveLiteRouterProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal _appAddress;

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address appAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _appAddress = appAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}


    /**
     * @dev A proxy to exchange
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (address[11] memory route,
        uint256[4][5] memory params,
        uint256 amount,
        uint256 min_dy) =
                abi.decode(arguments, (address[11], uint256[4][5], uint256, uint256));
        // claim tokens addresses
        address tokenA = route[0];
        // grant token approvals
        TransferHelper.safeApprove(tokenA, _appAddress, amount);

        uint256 amountOut = IRouter(_appAddress).exchange(
            route, params, amount, min_dy
        );

        address tokenOut;
        uint i = 0;
        for (;i < 11;) {
            if (route[i] == address(0)){
                tokenOut = route[i-1];
                break;
            }
            unchecked {
                i++;
            }
        }

        uint256 value;
        TokenAmount[] memory tokensToBridge;
        if (tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = amountOut;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(tokenOut, amountOut);
            TransferHelper.safeApprove(tokenOut, _getCrossChainLayerAddress(), amountOut);
            value = 0;
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, value);
    }

    /**
     * @dev A proxy to getDx
     * @param arguments arguments data
     */
    function getDx(
        bytes calldata arguments
    ) public view _onlyCrossChainLayer returns (uint256){
        (address[11] memory route,
        uint256[4][5] memory params,
        uint256 amount) = abi.decode(arguments, (address[11], uint256[4][5], uint256));

        uint256 amountOut = IRouter(_appAddress).get_dx(
            route, params, amount
        );

        return amountOut;
    }

    /**
     * @dev A proxy to getDy
     * @param arguments arguments data
     */
    function getDy(
        bytes calldata arguments
    ) public view _onlyCrossChainLayer returns (uint256){
        (address[11] memory route,
        uint256[4][5] memory params,
        uint256 amount) = abi.decode(arguments, (address[11], uint256[4][5], uint256));

        uint256 amountOut = IRouter(_appAddress).get_dy(
            route, params, amount
        );

        return amountOut;
    }


}
