
import hre, { ethers } from "hardhat";
import { deploy, TacLocalTestSdk, NFTInfo, NFTMintInfo, NFTUnlockInfo } from "@tonappchain/evm-ccl";
import { Signer } from "ethers";
import { TestERC721Token, TestNFTProxy } from "../typechain-types";
import { expect } from "chai";

describe("TacLocalTestSDK NFT", () => {

    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let testNFTProxy: TestNFTProxy;
    let existedERC721: TestERC721Token;

    before(async () => {
        // setup
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = testSdk.create(ethers.provider);

        existedERC721 = await deploy<TestERC721Token>(admin, hre.artifacts.readArtifactSync("TestERC721Token"), ["ExistedNFTToken", "NFTTokenE", "https://test-token.com/"], undefined, false);
        testNFTProxy = await deploy<TestNFTProxy>(admin, hre.artifacts.readArtifactSync("TestNFTProxy"), [crossChainLayerAddress], undefined, false);

    });

    it ('Test send message with nft', async () => {

        // define shards key (key for tracking message with tac-sdk)
        const shardsKey = 1n;
        // define operation id (it'll be created by tac infrasctaucture, but here you can define any bytes32 value)
        const operationId = ethers.encodeBytes32String("operationId");
        // define untrusted extra data by executor (it's not implemented yet on tac infrasctaucture - just empty bytes)
        const extraData = "0x";

        // define timestamp, when message was created on TVM
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        // define tvm wallet address who sent message
        const tvmWalletCaller = "TVMCallerAddress";

        // define nft collection info
        const nftCollectionInfo: NFTInfo = {
            tvmAddress: "NftCollectionAddress",
            name: "NftCollection1",
            symbol: "NFT1",
            baseURI: "https://nft1.com/",
        };

        // define nft mint info
        const nftMintInfo: NFTMintInfo = {
            info: nftCollectionInfo,
            tokenId: 1n,
        };

        // lock nft on cross-chain layer contract, like it was bridged from EVM previously
        const lockedTokenId = 1n;
        await (await existedERC721.mint(testSdk.getCrossChainLayerAddress(), lockedTokenId)).wait();

        // define unlock nft info
        const nftUnlockInfo: NFTUnlockInfo = {
            evmAddress: await existedERC721.getAddress(),
            tokenId: lockedTokenId,
            amount: 0n,
        };

        // define call arguments for target contract

        // calculate deployed nft address
        const calculatedNftTokenAddress = testSdk.getEVMNFTCollectionAddress(nftCollectionInfo.tvmAddress);

        // define target contract address
        const target = await testNFTProxy.getAddress();
        // define method name
        const methodName = "receiveNFT(bytes,bytes)";

        // define nft token to receive tuple: tuple(address,uint256,uint256)[]
        const receivedToken1 = [calculatedNftTokenAddress, nftMintInfo.tokenId, 0n];
        const receivedToken2 = [nftUnlockInfo.evmAddress, nftUnlockInfo.tokenId, nftUnlockInfo.amount];

        const encodedArguments = ethers.AbiCoder.defaultAbiCoder().encode(["tuple(address,uint256,uint256)[]"], [[receivedToken1, receivedToken2]]);

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessageWithNFT(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            [nftMintInfo],
            [nftUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(receipt.status).to.be.eq(1);

        // check deployed tokens
        expect(deployedTokens.length).to.be.eq(1);
        expect(deployedTokens[0].evmAddress).to.be.eq(calculatedNftTokenAddress);
        expect(deployedTokens[0].tvmAddress).to.be.eq(nftCollectionInfo.tvmAddress);

        // check out messages
        expect(outMessages.length).to.be.eq(1);
        const outMessage = outMessages[0];
        expect(outMessage.shardsKey).to.be.eq(shardsKey);
        expect(outMessage.operationId).to.be.eq(operationId);
        expect(outMessage.callerAddress).to.be.eq(await testNFTProxy.getAddress());
        expect(outMessage.targetAddress).to.be.eq(tvmWalletCaller);
        expect(outMessage.payload).to.be.eq("");
        // check burned erc20 token
        expect(outMessage.tokensBurned.length).to.be.eq(0);
        // check locked erc20 token
        expect(outMessage.tokensLocked.length).to.be.eq(0);
        // check burned nft token
        expect(outMessage.nftTokensBurned.length).to.be.eq(1);
        expect(outMessage.nftTokensBurned[0].evmAddress).to.be.eq(calculatedNftTokenAddress);
        expect(outMessage.nftTokensBurned[0].tokenId).to.be.eq(nftMintInfo.tokenId);
        // check locked nft token
        expect(outMessage.nftTokensLocked.length).to.be.eq(1);
        expect(outMessage.nftTokensLocked[0].evmAddress).to.be.eq(nftUnlockInfo.evmAddress);
        expect(outMessage.nftTokensLocked[0].tokenId).to.be.eq(nftUnlockInfo.tokenId);
    });
});