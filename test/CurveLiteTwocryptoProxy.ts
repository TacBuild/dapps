import hre, { ethers } from "hardhat";
import { AddressLike, BytesLike, Signer } from "ethers";
import { expect } from "chai";

import { deployCurveLiteTwocryptoswapProxy } from "../scripts/CurveLite/twocryptoswap/deployProxy";
import { deployPoolTwocryptoswap } from "../scripts/CurveLite/twocryptoswap/deployPoolTwocryptoswap";
import { CurveLiteTwocryptoswapTestnetConfig } from "../scripts/CurveLite/twocryptoswap/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "tac-l2-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';

import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { CurveLiteTwocryptoswapProxy } from "../typechain-types";
import { curveLiteTwocryptoProxySol } from "../typechain-types/factories/contracts/proxies/CurveLite";
import factoryAbi from "../scripts/CurveLite/twocryptoswap/factoryAbi.json"
import implementationAbi from "../scripts/CurveLite/twocryptoswap/implementationAbi.json"

describe("CurveLiteTwocryptoswapProxy", function () {
    let admin: Signer;

    let testSdk: TacLocalTestSdk;

    let CurveLiteTwocryptoswapProxy: CurveLiteTwocryptoswapProxy;
    
    let sttonToken: ERC20;
    let tacToken: ERC20;
    let FactoryContract: any;
    let PoolContract: any;
    let PoolAddress: string;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        CurveLiteTwocryptoswapProxy = await deployCurveLiteTwocryptoswapProxy(admin, crossChainLayerAddress);
        const FactoryContract = new ethers.Contract(CurveLiteTwocryptoswapTestnetConfig.CurveLiteTwocryptoswapFactory, factoryAbi, admin);
        
        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMTokenAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);
    
        PoolAddress = await deployPoolTwocryptoswap(sttonEVMTokenAddress, tacEVMTokenAddress, "stTON-TAC", "stTON-TAC");
        const PoolContract = new ethers.Contract(PoolAddress, implementationAbi, admin);
    });

    it ("CurveLiteTwocryptoswap test add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("add liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await CurveLiteTwocryptoswapProxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const baseTokenDecimals = sttonTokenInfo.decimals;
        const quoteTokenDecimals = tacTokenInfo.decimals;

        const baseToken = sttonEVMAddress;
        const quoteToken = tacEVMAddress;

        const tokenAAmount = 1000n * 10n**9n;
        const tokenBAmount = 1000n * 10n**9n;

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: tokenAAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            mintAmount: tokenBAmount,
        }


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256[2], uint256)'],
            [
                [
                    PoolAddress,
                    [tokenAAmount,tokenBAmount],
                    0
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo, tacTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        sttonToken = (new ethers.Contract(deployedTokens[0].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;
        tacToken = (new ethers.Contract(deployedTokens[1].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;

        expect(await sttonToken.name()).to.be.equal(sttonTokenInfo.name);
        expect(await sttonToken.symbol()).to.be.equal(sttonTokenInfo.symbol);
        expect(await sttonToken.decimals()).to.be.equal(sttonTokenInfo.decimals);
        expect(deployedTokens[0].tvmAddress).to.be.equal(sttonTokenInfo.tvmAddress);

        expect(await tacToken.name()).to.be.equal(tacTokenInfo.name);
        expect(await tacToken.symbol()).to.be.equal(tacTokenInfo.symbol);
        expect(await tacToken.decimals()).to.be.equal(tacTokenInfo.decimals);
        expect(deployedTokens[1].tvmAddress).to.be.equal(tacTokenInfo.tvmAddress);

        // check pool was created
        const poolAddress = await FactoryContract.find_pool_for_coins(sttonEVMAddress, tacToken, 0);
        expect(poolAddress).to.be.equal(PoolAddress);

        // check pool balances
        expect(await sttonToken.balanceOf(await PoolContract.getAddress())).to.be.equal(tokenAAmount);
        expect(await tacToken.balanceOf(await PoolContract.getAddress())).to.be.equal(tokenBAmount);

        const liquidity = await PoolContract.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await CurveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await CurveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });

    it ("CurveLiteTwocryptoswap test exchange", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await CurveLiteTwocryptoswapProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const baseTokenDecimals = sttonTokenInfo.decimals;
        const quoteTokenDecimals = tacTokenInfo.decimals;

        const baseToken = sttonEVMAddress;
        const quoteToken = tacEVMAddress;

        const tokenAAmount = 500n * 10n**9n;

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: tokenAAmount,
        }


        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, uint256, uint256)'],
            [
                [
                    PoolAddress,
                    0,
                    1,
                    tokenAAmount,
                    0
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedArguments, // encoded arguments
            tvmWalletCaller, // tvm caller
            [sttonTokenMintInfo], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        sttonToken = (new ethers.Contract(deployedTokens[0].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;
        tacToken = (new ethers.Contract(deployedTokens[1].evmAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin)) as unknown as ERC20;

        expect(await sttonToken.name()).to.be.equal(sttonTokenInfo.name);
        expect(await sttonToken.symbol()).to.be.equal(sttonTokenInfo.symbol);
        expect(await sttonToken.decimals()).to.be.equal(sttonTokenInfo.decimals);
        expect(deployedTokens[0].tvmAddress).to.be.equal(sttonTokenInfo.tvmAddress);

        expect(await tacToken.name()).to.be.equal(tacTokenInfo.name);
        expect(await tacToken.symbol()).to.be.equal(tacTokenInfo.symbol);
        expect(await tacToken.decimals()).to.be.equal(tacTokenInfo.decimals);
        expect(deployedTokens[1].tvmAddress).to.be.equal(tacTokenInfo.tvmAddress);

        // check pool was created
        const poolAddress = await FactoryContract.find_pool_for_coins(sttonEVMAddress, tacToken, 0);
        expect(poolAddress).to.be.equal(PoolAddress);

        // check pool balances
        expect(await sttonToken.balanceOf(await PoolContract.getAddress())).to.be.equal(tokenAAmount);

        const liquidity = await PoolContract.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(liquidity).to.gte(0n);

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await CurveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await CurveLiteTwocryptoswapProxy.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });


});
