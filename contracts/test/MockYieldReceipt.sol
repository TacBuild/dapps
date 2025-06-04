// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TestERC721Enumerable} from "./TestERC721EnumerableToken.sol";

import  {IReceipt} from "../proxies/Yield/IReceipt.sol";

struct ReceiptData {
    uint256 eligibleAt;
    uint256 amount;
}

contract ReceiptMock is TestERC721Enumerable, IReceipt {
    uint256 public counter;
    mapping(uint256 => ReceiptData) public receipts;
    mapping(uint256 => address) public assets;

    constructor() TestERC721Enumerable("YieldFi Withdrawal Receipt", "yWDR", "URI") {
        // counter по умолчанию 0
    }

    function mint(
        address _to,
        address _asset,
        uint256 _amount,
        uint256 _coolingPeriod
    ) external {
        require(_amount > 0 && _coolingPeriod > 0, "invalid args");

        uint256 tokenId = ++counter;
        _mint(_to, tokenId);

        receipts[tokenId] = ReceiptData(block.timestamp + _coolingPeriod, _amount);
        assets[tokenId] = _asset;
    }

    function readReceipt(uint256 tokenId) external view returns (uint256 eligibleAt, uint256 amount) {
        ReceiptData memory r = receipts[tokenId];
        return (r.eligibleAt, r.amount);
    }

    function readAsset(uint256 tokenId) external view returns (address) {
        return assets[tokenId];
    }

    function burn(uint256 tokenId) external {
        // Упрощенно, без проверок доступа
        _burn(tokenId);
        delete receipts[tokenId];
        delete assets[tokenId];
    }
}
