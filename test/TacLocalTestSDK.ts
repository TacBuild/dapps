
import hre, { ethers } from "hardhat";
import { deploy, TacLocalTestSdk, JettonInfo, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { Signer } from "ethers";
import { TestProxy, TestToken } from "../typechain-types";
import { expect } from "chai";
import { InvokeWithCallbackEvent } from "../typechain-types/contracts/test/TestProxy";


const abiCoder = ethers.AbiCoder.defaultAbiCoder();

describe("TacLocalTestSDK", () => {

    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let proxyContract: TestProxy;
    let existedToken: TestToken;

    before(async () => {
        // setup
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = testSdk.create(ethers.provider);
        
        existedToken = await deploy<TestToken>(admin, hre.artifacts.readArtifactSync("TestToken"), ["ExistedToken", "TokenE"], undefined, false);
        proxyContract = await deploy<TestProxy>(admin, hre.artifacts.readArtifactSync("TestProxy"), [crossChainLayerAddress], undefined, false);

    });

    it('Test send message', async () => {

        // define query id
        const shardsKey = 1n;
        // define operation id (it'll be created by tac infrasctaucture, but here you can define any bytes32 value)
        const operationId = ethers.encodeBytes32String("operationId");
        // define untrusted extra data by executor (it's not implemented yet on tac infrasctaucture - just empty bytes)
        const extraData = "0x";

        // define timestamp, when message was created on TVM
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        // define tvm wallet address who sent message
        const tvmWalletCaller = "TVMCallerAddress";
        // define jetton token info
        const jettonInfo: JettonInfo = {
            tvmAddress: "JettonMinterAddress", // jetton minter contract address
            name: "Jetton1",
            symbol: "JET1",
            decimals: 9n
        };

        // how much jetton to mint
        const tokenMintInfo: TokenMintInfo = {
            info: jettonInfo,
            mintAmount: 10n**9n,
        }

        // how much existed token to unlock
        const tokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: await existedToken.getAddress(),
            unlockAmount: 10n**18n,
        }
        // lock existed token on cross-chain layer contract, like it was bridged from EVM previously
        await (await existedToken.mint(testSdk.getCrossChainLayerAddress(), tokenUnlockInfo.unlockAmount)).wait();

        // calculate evm jetton address, which will be bridged on EVM after message is sent
        const calculatedTokenAddress = testSdk.getEVMJettonAddress(jettonInfo.tvmAddress);

        // define target contract address
        const target = await proxyContract.getAddress();
        // define method name
        const methodName = "invokeWithCallback(bytes,bytes)";

        // define jetton token to receive tuple: tuple(address,uint256)
        const receivedToken1 = [calculatedTokenAddress, tokenMintInfo.mintAmount];

        // define existed token to receive tuple: tuple(address,uint256)
        const receivedToken2 = [tokenUnlockInfo.evmAddress, tokenUnlockInfo.unlockAmount];

        // define array structs TokenAmount[] like tuple(address,uint256)[]
        const receivedTokens = [receivedToken1, receivedToken2]
        // encode arguments
        const encodedArguments = ethers.AbiCoder.defaultAbiCoder().encode(["tuple(address,uint256)[]"], [receivedTokens]);

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [tokenMintInfo],
            [tokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(receipt.status).to.be.eq(1);

        // check deployed tokens
        expect(deployedTokens.length).to.be.eq(1);
        expect(deployedTokens[0].evmAddress).to.be.eq(calculatedTokenAddress);
        expect(deployedTokens[0].tvmAddress).to.be.eq(jettonInfo.tvmAddress);

        // check out messages
        expect(outMessages.length).to.be.eq(1);
        const outMessage = outMessages[0];
        expect(outMessage.shardsKey).to.be.eq(shardsKey);
        expect(outMessage.operationId).to.be.eq(operationId);
        expect(outMessage.callerAddress).to.be.eq(await proxyContract.getAddress());
        expect(outMessage.targetAddress).to.be.eq(tvmWalletCaller);
        console.log(outMessage.payload);
        expect(outMessage.payload).to.be.eq("");
        // check burned token
        expect(outMessage.tokensBurned.length).to.be.eq(1);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.eq(calculatedTokenAddress);
        expect(outMessage.tokensBurned[0].amount).to.be.eq(tokenMintInfo.mintAmount);
        // check locked token
        expect(outMessage.tokensLocked.length).to.be.eq(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.eq(tokenUnlockInfo.evmAddress);
        expect(outMessage.tokensLocked[0].amount).to.be.eq(tokenUnlockInfo.unlockAmount);

        // check emited event
        let found = false;
        receipt.logs.forEach((log) => {
            const event = proxyContract.interface.parseLog(log);
            if (event && event.name === "InvokeWithCallback") {
                found = true;
                // event InvokeWithCallback(uint64 shardsKey, uint256 timestamp, string operationId, string tvmCaller, bytes extraData, TokenAmount[] receivedTokens);
                const typedEvent = event as unknown as InvokeWithCallbackEvent.LogDescription;
                expect(typedEvent.args.shardsKey).to.be.eq(shardsKey);
                expect(typedEvent.args.timestamp).to.be.eq(timestamp);
                expect(typedEvent.args.operationId).to.be.eq(operationId);
                expect(typedEvent.args.tvmCaller).to.be.eq(tvmWalletCaller);
                expect(typedEvent.args.extraData).to.be.eq(extraData);
                expect(typedEvent.args.receivedTokens.length).to.be.eq(2);
                expect(typedEvent.args.receivedTokens[0].l2Address).to.be.eq(calculatedTokenAddress);
                expect(typedEvent.args.receivedTokens[0].amount).to.be.eq(tokenMintInfo.mintAmount);
                expect(typedEvent.args.receivedTokens[1].l2Address).to.be.eq(tokenUnlockInfo.evmAddress);
                expect(typedEvent.args.receivedTokens[1].amount).to.be.eq(tokenUnlockInfo.unlockAmount);
            }
        });
        expect(found).to.be.true;
    });
});