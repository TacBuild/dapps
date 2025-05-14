
import hre, { ethers } from "hardhat";
import { deploy, TacLocalTestSdk, JettonInfo, TokenMintInfo, TokenUnlockInfo } from "@tonappchain/evm-ccl";
import { Signer, assertArgumentCount } from "ethers";
import { expect } from "chai";
import { TreasurySwapProxy } from "../typechain-types";
import { TestnetERC20 } from "../typechain-types";
import { TreasurySwap } from "../typechain-types";
import { ERC20 } from "../typechain-types/@openzeppelin/contracts/token/ERC20";
import { deployTreasurySwap } from "../scripts/treasurySwap/deployTreasurySwap";
import { deployTreasurySwapProxy } from "../scripts/treasurySwap/deployTreasurySwapProxy";

describe("TreasurySwap proxy test", () => {

    let admin: Signer;
    let testSdk: TacLocalTestSdk;

    let proxyContract: TreasurySwapProxy;
    let treasurySwapContract: TreasurySwap;
    let tokenContract: TestnetERC20;

    const tokenName = "TAC token";
    const tokenSymbol = "TAC";
    const tokenValue = 6400000000000000000n;
    const decimals = 18n;
    const upperBound = 10000000000000000000000n;
    const lowerBound = 50000000000000000n;
    const treasurySwapBalance = 10000000000000000000000000000n;

    let wTONAddress = "";
    let wTONContract: ERC20;
    let crossChainLayerAddress = "";

    before(async () => {
        // setup
        [admin] = await ethers.getSigners();

        testSdk = new TacLocalTestSdk();
        crossChainLayerAddress = await testSdk.create(ethers.provider);
        
        wTONAddress = testSdk.getWrappedTONAddress();
        wTONContract = await ethers.getContractAt("ERC20", wTONAddress);

    });

    it ('Deploy treasury and proxy', async() => {



        tokenContract = await deploy<TestnetERC20>(
            admin,
            hre.artifacts.readArtifactSync("TestnetERC20"),
            [tokenName, tokenSymbol, decimals]
        );
        treasurySwapContract = await deployTreasurySwap(
            admin,
            wTONAddress,
            await tokenContract.getAddress(),
            tokenValue,
            decimals,
            upperBound,
            lowerBound,
            false
        );
        proxyContract = await deployTreasurySwapProxy(
            admin,
            await treasurySwapContract.getAddress(),
            wTONAddress,
            crossChainLayerAddress,
            false
        );
        // deposit token to treasurySwap
        await tokenContract.connect(admin).mint(await treasurySwapContract.getAddress(), treasurySwapBalance);

        // get tokens to admin
        await tokenContract.connect(admin).mint(await admin.getAddress(), "1000000000000000000000000000");
    });

    it('Check address consistency', async () => {
        expect(await treasurySwapContract.token()).to.be.eq(await tokenContract.getAddress())
        expect(await treasurySwapContract.wTON()).to.be.eq(wTONAddress);
        expect(await treasurySwapContract.tokenValue()).to.be.eq(tokenValue);
        expect(await treasurySwapContract.upperBound()).to.be.eq(upperBound);
        expect(await treasurySwapContract.lowerBound()).to.be.eq(lowerBound);
        expect(await treasurySwapContract.decimals()).to.be.eq(decimals);
    });

    it('Mint message', async () => {
        // define shards key
        const shardsKey = 1n;
        // define operation id (it'll be created by tac infrasctaucture, but here you can define any string)
        const operationId = ethers.encodeBytes32String("test mint message");
        // define untrusted extra data by executor (it's not implemented yet on tac infrasctaucture - just empty bytes)
        const extraData = "0x";

        // define timestamp, when message was created on TVM
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        // define tvm wallet address who sent message
        const tvmWalletCaller = "TVMCallerAddress";
        // define jetton token info
        const jettonInfo: JettonInfo = {
            tvmAddress: "NONE", // jetton minter contract address
            name: "TON",
            symbol: "TON",
            decimals: 9n
        };

        // how much jetton to mint
        const tokenMintInfo: TokenMintInfo = {
            info: jettonInfo,
            amount: 10n**9n,
        }

        // define target contract address
        const target = await proxyContract.getAddress();
        // define method name
        const methodName = "mint(bytes,bytes)";
        // encode arguments of proxy contract
        const encodedArguments = ethers.AbiCoder.defaultAbiCoder().encode(["tuple(address,uint256)"], [[target, tokenMintInfo.amount]]);

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [tokenMintInfo],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(receipt.status).to.be.eq(1);

        // check deployed tokens
        expect(deployedTokens.length).to.be.eq(0);

        // check out messages
        expect(outMessages.length).to.be.eq(1);
        const outMessage = outMessages[0];
        expect(outMessage.shardsKey).to.be.eq(shardsKey);
        expect(outMessage.operationId).to.be.eq(operationId);
        expect(outMessage.callerAddress).to.be.eq(await proxyContract.getAddress());
        expect(outMessage.targetAddress).to.be.eq(tvmWalletCaller);
        expect(outMessage.payload).to.be.eq("");

        // check burned token
        expect(outMessage.tokensBurned.length).to.be.eq(0);

        // check locked token
        expect(outMessage.tokensLocked.length).to.be.eq(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.eq(await tokenContract.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.eq(tokenValue);

        // check crossChainLayer and tresaurySwap balance 
        expect(await wTONContract.balanceOf(crossChainLayerAddress)).to.be.eq(0n);
        expect(await tokenContract.balanceOf(await treasurySwapContract.getAddress())).to.be.eq(BigInt(treasurySwapBalance) - BigInt(tokenValue));
        expect(await tokenContract.balanceOf(crossChainLayerAddress)).to.be.eq(tokenValue);
        expect(await treasurySwapContract.treasurywTONBalance()).to.be.eq(10n**9n);
    });

    it('Burn message', async () => {
        // save ton balance before
        const tonBalanceBefore = await treasurySwapContract.treasurywTONBalance();

        // define shards key
        const shardsKey = 1n;
        // define operation id (it'll be created by tac infrasctaucture, but here you can define any string)
        const operationId = ethers.encodeBytes32String("test burn message");
        // define untrusted extra data by executor (it's not implemented yet on tac infrasctaucture - just empty bytes)
        const extraData = "0x";

        // define timestamp, when message was created on TVM
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        // define tvm wallet address who sent message
        const tvmWalletCaller = "TVMCallerAddress";

        // token to unlock
        const tokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: await tokenContract.getAddress(),
            amount: 10n**18n,
        }
        await (await tokenContract.mint(testSdk.getCrossChainLayerAddress(), tokenUnlockInfo.amount)).wait();

        // define target contract address
        const target = await proxyContract.getAddress();
        // define method name
        const methodName = "burn(bytes,bytes)";
        // encode arguments of proxy contract
        const encodedArguments = ethers.AbiCoder.defaultAbiCoder().encode(["tuple(address,uint256)"], [[target, tokenUnlockInfo.amount]]);

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [tokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        expect(receipt.status).to.be.eq(1);

        // check deployed tokens
        expect(deployedTokens.length).to.be.eq(0);

        // check out messages
        expect(outMessages.length).to.be.eq(1);
        const outMessage = outMessages[0];
        expect(outMessage.shardsKey).to.be.eq(shardsKey);
        expect(outMessage.operationId).to.be.eq(operationId);
        expect(outMessage.callerAddress).to.be.eq(await proxyContract.getAddress());
        expect(outMessage.targetAddress).to.be.eq(tvmWalletCaller);
        expect(outMessage.payload).to.be.eq("");

        // check burned token
        expect(outMessage.tokensBurned.length).to.be.eq(1);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.eq(wTONAddress);
        expect(outMessage.tokensBurned[0].amount).to.be.eq(tokenUnlockInfo.amount * 10n**9n / BigInt(tokenValue));

        // check locked token
        expect(outMessage.tokensLocked.length).to.be.eq(0);

        // check crossChainLayer and tresaurySwap balance
        expect(await wTONContract.balanceOf(crossChainLayerAddress)).to.be.eq(0n);
        expect(await treasurySwapContract.treasurywTONBalance()).to.be.eq(tonBalanceBefore - tokenUnlockInfo.amount * 10n**9n / BigInt(tokenValue));
    });
});