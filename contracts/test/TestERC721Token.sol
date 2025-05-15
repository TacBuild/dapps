// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721Token is ERC721 {

    string private __baseURI;

    constructor(string memory _name, string memory _symbol, string memory baseURI) ERC721(_name, _symbol) {
        __baseURI = baseURI;
    }

    function mint(address _to, uint256 _tokenId) external {
        _mint(_to, _tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }
}