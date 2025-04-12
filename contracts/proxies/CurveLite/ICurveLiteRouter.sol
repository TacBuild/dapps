// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

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
