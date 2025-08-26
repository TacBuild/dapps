// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { TacProxyV1Upgradeable } from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import { OutMessageV1, TokenAmount, NFTAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRouter } from "contracts/proxies/CurveLite/ICurveLiteRouter.sol";
import { ITacSmartAccount } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ITacSmartAccount.sol";
import { ISAFactory } from "@tonappchain/evm-ccl/contracts/smart-account/interfaces/ISAFactory.sol";

/**
 * @title CurveLiteRouterProxy
 * @dev Proxy contract CurveLite, working with router
 */
contract CurveLiteRouterProxy is TacProxyV1Upgradeable, Ownable2StepUpgradeable, UUPSUpgradeable {
    address public constant _ETH_ADDRESS_ = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal _routerAddress;
    ISAFactory internal _smartAccountFactory;
    ///@dev This is the maximum possible length for swap route handled by curve
    uint256 internal constant MAX_CURVE_ROUTE_LENGTH = 11;
    ///@dev This is the internal  params length for curve
    uint256 internal constant MAX_CURVE_PARAMS_LENGTH_Y = 5;
    ///@dev This is the internal  params length for curve
    uint256 internal constant MAX_CURVE_PARAMS_LENGTH_X = 4;

    struct ExchangeParams {
        address[MAX_CURVE_ROUTE_LENGTH] route;
        uint256[MAX_CURVE_PARAMS_LENGTH_X][MAX_CURVE_PARAMS_LENGTH_Y] curveParams;
        uint256 amount;
        uint256 min_dy;
        address tokenOut;
    }

    error ValueAndAmountInMismatch();
    error ETHTransferFailed();

    event CurveExchange(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor() {
        _disableInitializers();
    }

    function initialize(address adminAddress, address routerAddress, address crossChainLayer, address smartAccountFactoryAddress) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        _routerAddress = routerAddress;
        _smartAccountFactory = ISAFactory(smartAccountFactoryAddress);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function exchange(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        (address user,) = _smartAccountFactory.getOrCreateSmartAccount(header.tvmCaller);

        ExchangeParams memory params = abi.decode(arguments, (ExchangeParams));
        address tokenA = params.route[0];

        if (tokenA == _ETH_ADDRESS_) {
            require(msg.value == params.amount, ValueAndAmountInMismatch());
            (bool success,) = payable(user).call{value: params.amount}("");
            require(success, ETHTransferFailed());
        } else {
            SafeERC20.safeTransfer(IERC20(tokenA), user, params.amount);
            ITacSmartAccount(payable(user)).approve(tokenA, _routerAddress, params.amount);
        }
        
        bytes memory data = abi.encodeWithSelector(IRouter.exchange.selector, params.route, params.curveParams, params.amount, params.min_dy, address(this));
        bytes memory outData =ITacSmartAccount(payable(user)).execute(_routerAddress, tokenA == _ETH_ADDRESS_ ? params.amount : 0, data);
        (uint256 amountOut) = abi.decode(outData, (uint256));

        uint256 value = 0;
        TokenAmount[] memory tokensToBridge;
        if (params.tokenOut == _ETH_ADDRESS_) {
            tokensToBridge = new TokenAmount[](0);
            value = amountOut;
        } else {
            tokensToBridge = new TokenAmount[](1);
            tokensToBridge[0] = TokenAmount(params.tokenOut, amountOut);
        }

        emit CurveExchange(user, tokenA, params.tokenOut, params.amount, amountOut);

        _bridgeTokens(tacHeader, tokensToBridge, "", value);
    }

    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        string memory payload,
        uint256 nativeTacAmount
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            SafeERC20.forceApprove(
                IERC20(tokens[i].evmAddress),
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OutMessageV1 memory message = OutMessageV1({
            shardsKey: header.shardsKey,
            tvmTarget: header.tvmCaller,
            tvmPayload: payload,
            tvmProtocolFee: 0,
            tvmExecutorFee: 0,
            tvmValidExecutors: new string[](0),
            toBridge: tokens,
            toBridgeNFT: new NFTAmount[](0)
        });

        _sendMessageV1(message, nativeTacAmount);
    }

    receive() external payable {}
}
