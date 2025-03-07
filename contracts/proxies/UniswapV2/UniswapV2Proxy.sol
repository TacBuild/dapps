// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { IUniswapV2Router02 } from '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import { TransferHelper } from '@uniswap/lib/contracts/libraries/TransferHelper.sol';

import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/L2/Structs.sol";
import { UniswapV2Library } from "contracts/proxies/UniswapV2/CompilerVersionAdapters.sol";
import { ICrossChainLayer } from "@tonappchain/evm-ccl/contracts/interfaces/ICrossChainLayer.sol";

struct AddLiquidityArguments {
    address tokenA;
    address tokenB;
    uint amountADesired;
    uint amountBDesired;
    uint amountAMin;
    uint amountBMin;
    address to;
    uint deadline;
}

struct RemoveLiquidityArguments {
    address tokenA;
    address tokenB;
    uint liquidity;
    uint amountAMin;
    uint amountBMin;
    address to;
    uint deadline;
}

struct RemoveLiquidityETHArguments {
    address token;
    uint liquidity;
    uint amountTokenMin;
    uint amountETHMin;
    address to;
    uint deadline;
}

struct SwapExactTokensForTokensArguments {
    uint amountIn;
    uint amountOutMin;
    address[] path;
    address to;
    uint deadline;
}

struct SwapTokensForExactTokensArguments {
    uint amountOut;
    uint amountInMax;
    address[] path;
    address to;
    uint deadline;
}

struct AddLiquidityETHArguments {
    address token;
    uint amountTokenDesired;
    uint amountTokenMin;
    uint amountETHMin;
    address to;
    uint deadline;
}

struct SwapExactETHForTokensArguments {
    uint amountOutMin;
    address[] path;
    address to;
    uint deadline;
}

struct SwapExactTokensForETHArguments {
    uint amountIn;
    uint amountOutMin;
    address[] path;
    address to;
    uint deadline;
}

/**
 * @title UniswapV2Proxy
 * @dev Proxy contract UniswapV2, namely UniswapV2Router02
 */
contract UniswapV2Proxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    // State variables
    address internal _appAddress;
    
    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress,address appAddress, address crossChainLayer) public initializer {
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
     * @dev Returns the application address.
     * @return address The application address.
     */
    function getAppAddress() external view returns (address) {
        return _appAddress;
    }

    function WETH() external view returns (address) {
        return IUniswapV2Router02(_appAddress).WETH();
    }

    function _addLiquidityETH(
        AddLiquidityETHArguments memory arguments
    ) internal returns (TokenAmount[] memory, uint256) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.token, _appAddress, arguments.amountTokenDesired);

        // proxy call
        (uint amountToken, uint amountETH, uint liquidity) = IUniswapV2Router02(_appAddress).addLiquidityETH{value: msg.value}(
            arguments.token,
            arguments.amountTokenDesired,
            arguments.amountTokenMin,
            arguments.amountETHMin,
            arguments.to,
            arguments.deadline
        );

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);

        tokensToBridge[0] = TokenAmount(arguments.token, arguments.amountTokenDesired - amountToken);

        // tokens to L2->L1 transfer (lock)
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), IUniswapV2Router02(_appAddress).WETH(), arguments.token);
        tokensToBridge[1] = TokenAmount(tokenLiquidity, liquidity);

        return (tokensToBridge, amountETH);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.addLiquidity(...).
     */
    function addLiquidityETH(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external payable _onlyCrossChainLayer {

        AddLiquidityETHArguments memory args = abi.decode(arguments, (AddLiquidityETHArguments));
        (TokenAmount[] memory tokensToBridge, uint256 amountETH) = _addLiquidityETH(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, msg.value - amountETH);
    }

    function _swapExactETHForTokens(
        SwapExactETHForTokensArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // proxy call
        uint[] memory amounts = IUniswapV2Router02(_appAddress).swapExactETHForTokens{value: msg.value}(
            arguments.amountOutMin,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(arguments.path[arguments.path.length - 1], amounts[amounts.length - 1]);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactETHForTokens(...).
     */
    function swapExactETHForTokens(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        SwapExactETHForTokensArguments memory args = abi.decode(arguments, (SwapExactETHForTokensArguments));
        TokenAmount[] memory tokensToBridge = _swapExactETHForTokens(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, 0);
    }

    function _swapExactTokensForETH(
        SwapExactTokensForETHArguments memory arguments
    ) internal returns (TokenAmount[] memory, uint256) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.path[0], _appAddress, arguments.amountIn);

        // proxy call
        uint[] memory amounts = IUniswapV2Router02(_appAddress).swapExactTokensForETH(
            arguments.amountIn,
            arguments.amountOutMin,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](0);

        return (tokensToBridge, amounts[amounts.length - 1]);
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForETH(...).
     */
    function swapExactTokensForETH(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {
        SwapExactTokensForETHArguments memory args = abi.decode(arguments, (SwapExactTokensForETHArguments));
        (TokenAmount[] memory tokensToBridge, uint256 amountETH) = _swapExactTokensForETH(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });

        _sendMessageV1(message, amountETH);
    }

    function _addLiquidity(
        AddLiquidityArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.tokenA, _appAddress, arguments.amountADesired);
        TransferHelper.safeApprove(arguments.tokenB, _appAddress, arguments.amountBDesired);

        // proxy call
        (uint amountA, uint amountB, uint liquidity) = IUniswapV2Router02(_appAddress).addLiquidity(
            arguments.tokenA,
            arguments.tokenB,
            arguments.amountADesired,
            arguments.amountBDesired,
            arguments.amountAMin,
            arguments.amountBMin,
            arguments.to,
            arguments.deadline
        );

        // bridge remaining tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](3);
        tokensToBridge[0] = TokenAmount(arguments.tokenA, arguments.amountADesired - amountA);
        tokensToBridge[1] = TokenAmount(arguments.tokenB, arguments.amountBDesired - amountB);
        // bridge LP tokens to TON
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), arguments.tokenA, arguments.tokenB);
        tokensToBridge[2] = TokenAmount(tokenLiquidity, liquidity);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.addLiquidity(...).
     */
    function addLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {

        AddLiquidityArguments memory args = abi.decode(arguments, (AddLiquidityArguments));
        TokenAmount[] memory tokensToBridge = _addLiquidity(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    function _removeLiquidity(
        RemoveLiquidityArguments memory arguments
    ) internal returns (TokenAmount[] memory) {

        // grant token approvals
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), arguments.tokenA, arguments.tokenB);
        TransferHelper.safeApprove(tokenLiquidity, _appAddress, arguments.liquidity);

        // proxy call
        (uint amountA, uint amountB) = IUniswapV2Router02(_appAddress).removeLiquidity(
            arguments.tokenA,
            arguments.tokenB,
            arguments.liquidity,
            arguments.amountAMin,
            arguments.amountBMin,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(arguments.tokenA, amountA);
        tokensToBridge[1] = TokenAmount(arguments.tokenB, amountB);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.removeLiquidity(...).
     */
    function removeLiquidity(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {

        RemoveLiquidityArguments memory args = abi.decode(arguments, (RemoveLiquidityArguments));
        TokenAmount[] memory tokensToBridge = _removeLiquidity(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    function _removeLiquidityETH(
        RemoveLiquidityETHArguments memory arguments
    ) internal returns (TokenAmount[] memory, uint256 ethAmount) {

        // grant token approvals
        address tokenLiquidity = UniswapV2Library.pairFor(IUniswapV2Router02(_appAddress).factory(), arguments.token, IUniswapV2Router02(_appAddress).WETH());
        TransferHelper.safeApprove(tokenLiquidity, _appAddress, arguments.liquidity);

        // proxy call
        (uint amountToken, uint amountETH) = IUniswapV2Router02(_appAddress).removeLiquidityETH(
            arguments.token,
            arguments.liquidity,
            arguments.amountTokenMin,
            arguments.amountETHMin,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(arguments.token, amountToken);

        return (tokensToBridge, amountETH);
    }

    function removeLiquidityETH(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {

        RemoveLiquidityETHArguments memory args = abi.decode(arguments, (RemoveLiquidityETHArguments));
        (TokenAmount[] memory tokensToBridge, uint256 ethAmount) = _removeLiquidityETH(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, ethAmount);
    }

    function _swapExactTokensForTokens(
        SwapExactTokensForTokensArguments memory arguments
    ) internal returns (TokenAmount[] memory) {

        // grant token approvals
        TransferHelper.safeApprove(arguments.path[0], _appAddress, arguments.amountIn);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapExactTokensForTokens(
            arguments.amountIn,
            arguments.amountOutMin,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(arguments.path[arguments.path.length - 1], amounts[amounts.length - 1]);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapExactTokensForTokens(...).
     */
    function swapExactTokensForTokens(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {

        SwapExactTokensForTokensArguments memory args = abi.decode(arguments, (SwapExactTokensForTokensArguments));
        TokenAmount[] memory tokensToBridge = _swapExactTokensForTokens(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    function _swapTokensForExactTokens(
        SwapTokensForExactTokensArguments memory arguments
    ) internal returns (TokenAmount[] memory) {
        // grant token approvals
        TransferHelper.safeApprove(arguments.path[0], _appAddress, arguments.amountInMax);

        // proxy call
        (uint[] memory amounts) = IUniswapV2Router02(_appAddress).swapTokensForExactTokens(
            arguments.amountOut,
            arguments.amountInMax,
            arguments.path,
            arguments.to,
            arguments.deadline
        );

        // bridge tokens to TON
        TokenAmount[] memory tokensToBridge = new TokenAmount[](2);
        tokensToBridge[0] = TokenAmount(arguments.path[0], arguments.amountInMax - amounts[0]);
        tokensToBridge[1] = TokenAmount(arguments.path[arguments.path.length - 1], amounts[amounts.length - 1]);

        return tokensToBridge;
    }

    /**
     * @dev A proxy to IUniswapV2Router02.swapTokensForExactTokens(...).
     */
    function swapTokensForExactTokens(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) external _onlyCrossChainLayer {

        SwapTokensForExactTokensArguments memory args = abi.decode(arguments, (SwapTokensForExactTokensArguments));
        TokenAmount[] memory tokensToBridge = _swapTokensForExactTokens(args);

        uint i;
        for (; i < tokensToBridge.length;) {
            TransferHelper.safeApprove(tokensToBridge[i].l2Address, _getCrossChainLayerAddress(), tokensToBridge[i].amount);
            unchecked {
                i++;
            }
        }

        // CCL TAC->TON callback
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: "",
            toBridge: tokensToBridge
        });
        _sendMessageV1(message, 0);
    }

    receive() external payable {}
}
