// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import { TransferHelper } from 'contracts/helpers/TransferHelper.sol';
import {TacProxyV1Upgradeable} from "@tonappchain/evm-ccl/contracts/proxies/TacProxyV1Upgradeable.sol";
import {OutMessageV1, TokenAmount, TacHeaderV1, NFTAmount} from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

import {TacSmartAccount} from "../../TacSmartAccounts/TacSmartAccount.sol";
import {TacSAFactory} from "../../TacSmartAccounts/TacSAFactory.sol";
import {ITacSmartAccount} from "../../TacSmartAccounts/Interface/ITacSmartAccount.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Codec, OrderPayload} from "./Codec.sol";
import {IManager} from "./IManager.sol";
import {ISToken} from "./ISToken.sol";


/**
 * @title YieldManagerProxy
 * @dev Proxy contract for Yield Manager
 */
contract YieldManagerProxy is TacProxyV1Upgradeable, OwnableUpgradeable, UUPSUpgradeable {

    address internal _managerAddress;
    address internal _sUSD;
    address internal _yUSD;
    address internal _tacSAFactoryAddress;


    /// @notice Arguments for claiming rewards
    /// @param account Address of the account claiming rewards
    /// @param reward Address of the reward token
    /// @param claimable Amount of rewards claimable
    /// @param proof Merkle proof for claiming rewards
    struct ClaimArguments {
        address account;
        address reward;
        uint256 claimable;
        bytes32[] proof;
    }

    /**
     * @dev Initialize the contract.
     */
    function initialize(address adminAddress, address managerAddress, address sUSD, address yUSD,  address tacSAFactoryAddress, address crossChainLayer) public initializer {
        __TacProxyV1Upgradeable_init(crossChainLayer);
        __Ownable_init(adminAddress);
        __UUPSUpgradeable_init();
        _tacSAFactoryAddress = tacSAFactoryAddress;
        _sUSD = sUSD;
        _yUSD = yUSD;
        _managerAddress = managerAddress;
    }

    /**
     * @dev Upgrades the contract.
     */
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev A proxy to deposit
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function deposit(
        bytes calldata tacHeader,
        bytes calldata arguments
    ) public payable _onlyCrossChainLayer {
        (bytes memory _data, bytes  memory  _sign) =
                abi.decode(arguments, (bytes, bytes));
        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OrderPayload memory payload = Codec.decodeOrderPayload(_data);
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        // grant token approvals
        TransferHelper.safeTransfer(payload.token, user, payload.amount);

        ITacSmartAccount(user).execute(
            payload.token,
            0,
            abi.encodeWithSelector(
                IERC20(payload.token).approve.selector,
                _managerAddress,
                payload.amount
            )
        );


        ITacSmartAccount(user).execute(
            _managerAddress,
            0,
            abi.encodeWithSelector(
                IManager.deposit.selector,
                _data, _sign
                )
        );

        uint256 yUSDSaBalance = IERC20(_yUSD).balanceOf(user);

        ITacSmartAccount(user).execute(
            _yUSD,
            0,
            abi.encodeWithSelector(
                IERC20(_yUSD).transfer.selector,
                address(this),
                yUSDSaBalance
                )
        );

        TokenAmount[] memory tokensToBridge = new TokenAmount[](1);
        tokensToBridge[0] = TokenAmount(
            _yUSD,
            IERC20(_yUSD).balanceOf(address(this))
        );
        NFTAmount[] memory nftsToBridge = new NFTAmount[](0);

        _bridgeTokens(tacHeader, tokensToBridge, nftsToBridge, "");

    }


    /**
     * @dev A proxy to withdraw
     * @param tacHeader TacHeaderV1 struct containing the header information
     * @param arguments arguments data
     */
    function withdraw(
    bytes calldata tacHeader,
    bytes calldata arguments
    ) public _onlyCrossChainLayer {
        (bytes memory _data, bytes memory _sign) =
            abi.decode(arguments, (bytes, bytes));

        TacHeaderV1 memory header = _decodeTacHeader(tacHeader);
        OrderPayload memory payload = Codec.decodeOrderPayload(_data);
        (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

        TransferHelper.safeTransfer(_yUSD, user, payload.amount);

        ITacSmartAccount(user).execute(
            _yUSD,
            0,
            abi.encodeWithSelector(
                IERC20(_yUSD).approve.selector,
                _managerAddress,
                payload.amount
            )
        );

        ITacSmartAccount(user).execute(
                _managerAddress,
                0,
                abi.encodeWithSelector(
                    IManager.withdraw.selector,
                    _data, _sign
                    )
            );


        uint256 balance = IERC721Enumerable(_sUSD).balanceOf(user);
        require(balance > 0, "No NFTs");

        uint256 nftId = IERC721Enumerable(_sUSD).tokenOfOwnerByIndex(user, balance - 1);

        ITacSmartAccount(user).execute(
            address(_sUSD),
            0,
            abi.encodeWithSelector(
                IERC721(_sUSD).transferFrom.selector,
                user,
                address(this),
                nftId
            )
        );
        TokenAmount[] memory tokensToBridge = new TokenAmount[](0);
        NFTAmount[] memory nftsToBridge = new NFTAmount[](1);
        nftsToBridge[0] = NFTAmount(address(_sUSD), nftId, 0);

        _bridgeTokens(tacHeader, tokensToBridge , nftsToBridge, "");
    }

    function claim(
    bytes calldata tacHeader,
    bytes calldata arguments
) public _onlyCrossChainLayer {
    (uint256 receiptId, address receiver) = abi.decode(arguments, (uint256, address));

    TacHeaderV1 memory header = _decodeTacHeader(tacHeader);

    (address user, bool isNewAccount) = TacSAFactory(_tacSAFactoryAddress).getOrCreateSmartAccount(header.tvmCaller);

    ITacSmartAccount(user).execute(
        _sUSD,
        0,
        abi.encodeWithSelector(
            ISToken(_sUSD).claim.selector,
            receiptId,
            receiver
        )
    );
}


    /// @notice Bridges tokens and NFTs to the cross-chain layer
    /// @param tacHeader TAC header data
    /// @param tokens Array of token amounts to bridge
    /// @param nfts Array of NFT amounts to bridge
    /// @param payload Additional payload data
    function _bridgeTokens(
        bytes calldata tacHeader,
        TokenAmount[] memory tokens,
        NFTAmount[] memory nfts,
        string memory payload
    ) private {
        for (uint256 i = 0; i < tokens.length; i++) {
            TransferHelper.safeApprove(
                tokens[i].evmAddress,
                _getCrossChainLayerAddress(),
                tokens[i].amount
            );
        }

        for (uint256 i = 0; i < nfts.length; i++) {
            IERC721(nfts[i].evmAddress).approve(_getCrossChainLayerAddress(), nfts[i].tokenId);
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
            toBridgeNFT: nfts
        });

        _sendMessageV1(message, address(this).balance);
    }
}
