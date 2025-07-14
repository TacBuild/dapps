// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721Enumerable is ERC721Enumerable {

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

    // Переопределяем required by Solidity (т.к. наследуем ERC721 и ERC721Enumerable)
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}


interface ITestERC721Enumerable {
    // ERC721 standard functions
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);

    // ERC721Enumerable extensions
    function totalSupply() external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256 tokenId);
    function tokenByIndex(uint256 index) external view returns (uint256);

    // Mint function from your contract
    function mint(address to, uint256 tokenId) external;
}
