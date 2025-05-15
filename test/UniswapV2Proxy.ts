
import hre, { ethers } from 'hardhat';
import { Signer } from 'ethers';

import { deployUniswapV2 } from '../scripts/UniswapV2/deployUniswapV2';
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';
import { JettonInfo, TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo } from '@tonappchain/evm-ccl';
import { expect } from "chai";

import { IUniswapV2Factory, IUniswapV2Pair, IUniswapV2Router02, UniswapV2Proxy } from '../typechain-types';
import { ERC20, WTAC } from '@tonappchain/evm-ccl/dist/typechain-types';

import wTACArtifact from '@tonappchain/evm-ccl/dist/artifacts/contracts/WTAC.sol/WTAC.json';
import erc20Artifact from '../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import uniswapPairArtifact from '../artifacts/@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json';



describe('UniswapV2Proxy', () => {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let uniswapV2Factory: IUniswapV2Factory
    let uniswapV2Router02: IUniswapV2Router02;
    let uniswapV2Proxy: UniswapV2Proxy;

    let sttonToken: ERC20;
    let tacToken: ERC20;
    let wTAC: WTAC;

    before(async () => {
        // setup
        [admin] = await ethers.getSigners();

        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log(`CrossChainLayer deployed at: ${crossChainLayerAddress}`);
        wTAC = (new ethers.Contract(testSdk.getWTACAddress(), wTACArtifact.abi, admin)) as unknown as WTAC;
        console.log(`WTAC deployed at: ${await wTAC.getAddress()}`);

        ({ uniswapV2Factory, uniswapV2Router02, uniswapV2Proxy } = await deployUniswapV2(admin, await wTAC.getAddress(), crossChainLayerAddress));
    });

    it('Test addLiquidity', async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test addLiquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "addLiquidity(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMTokenAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const sttonAmount = 10000n * 10n**9n;
        const tacAmount= 20000n * 10n**9n;

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: sttonAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            amount: tacAmount,
        }

        // initial liquidity must add all tokens to the pool
        const sttonMinAmount = sttonTokenMintInfo.amount;
        const tacMinAmount = tacTokenMintInfo.amount;

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ["tuple(address,address,uint256,uint256,uint256,uint256,address,uint256)"],
            [
                [
                    sttonEVMTokenAddress,
                    tacEVMTokenAddress,
                    sttonTokenMintInfo.amount,
                    tacTokenMintInfo.amount,
                    sttonMinAmount,
                    tacMinAmount,
                    target,
                    deadline,
                ]
            ]
        )
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

        sttonToken = (new ethers.Contract(deployedTokens[0].evmAddress, erc20Artifact.abi, admin)) as unknown as ERC20;
        tacToken = (new ethers.Contract(deployedTokens[1].evmAddress, erc20Artifact.abi, admin)) as unknown as ERC20;

        expect(await sttonToken.name()).to.be.equal(sttonTokenInfo.name);
        expect(await sttonToken.symbol()).to.be.equal(sttonTokenInfo.symbol);
        expect(await sttonToken.decimals()).to.be.equal(sttonTokenInfo.decimals);
        expect(deployedTokens[0].tvmAddress).to.be.equal(sttonTokenInfo.tvmAddress);

        expect(await tacToken.name()).to.be.equal(tacTokenInfo.name);
        expect(await tacToken.symbol()).to.be.equal(tacTokenInfo.symbol);
        expect(await tacToken.decimals()).to.be.equal(tacTokenInfo.decimals);
        expect(deployedTokens[1].tvmAddress).to.be.equal(tacTokenInfo.tvmAddress);

        // check pair was created
        const pairAddress = await uniswapV2Factory.getPair(await sttonToken.getAddress(), await tacToken.getAddress());
        expect(pairAddress).to.not.be.equal(ethers.ZeroAddress);

        // check liquidity was added
        expect(await sttonToken.balanceOf(pairAddress)).to.be.equal(sttonTokenMintInfo.amount);
        expect(await tacToken.balanceOf(pairAddress)).to.be.equal(tacTokenMintInfo.amount);

        // check crossChainLayer LP token balance
        const lpToken = (new ethers.Contract(pairAddress, uniswapPairArtifact.abi, admin)) as unknown as IUniswapV2Pair;

        const lpMintedAmount = await lpToken.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(lpMintedAmount).to.gte(0n);

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(0);
        // lp token locked
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(pairAddress);
        expect(outMessage.tokensLocked[0].amount).to.be.equal(lpMintedAmount);
    });

    it ('Test addLiquidityETH', async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test addLiquidityETH");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "addLiquidityETH(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        const sttonAmount = 1000n * 10n**9n;
        const ethAmount = 2000n * 10n**9n;
        // lock native tac token on CCL
        await testSdk.lockNativeTacOnCrossChainLayer(ethAmount);

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: sttonAmount,
        }

        // initial liquidity must add all tokens to the pool
        const sttonMinAmount = sttonTokenMintInfo.amount;
        const ethMinAmount = ethAmount;

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, uint256, address, uint256)'],
            [
                [
                    sttonEVMTokenAddress,
                    sttonAmount,
                    sttonMinAmount,
                    ethMinAmount,
                    target,
                    deadline,
                ]
            ]
        )
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [sttonTokenMintInfo],
            [],
            ethAmount,
            extraData,
            operationId,
            timestamp
        );

        const pairAddress = await uniswapV2Factory.getPair(await sttonToken.getAddress(), await wTAC.getAddress());
        expect(pairAddress).to.not.be.equal(ethers.ZeroAddress);

        // check liquidity was added
        expect(await sttonToken.balanceOf(pairAddress)).to.be.equal(sttonTokenMintInfo.amount);
        expect(await wTAC.balanceOf(pairAddress)).to.be.equal(ethAmount);

        // check crossChainLayer LP token balance
        const lpToken = (new ethers.Contract(pairAddress, uniswapPairArtifact.abi, admin)) as unknown as IUniswapV2Pair;

        const lpMintedAmount = await lpToken.balanceOf(testSdk.getCrossChainLayerAddress());
        expect(lpMintedAmount).to.gte(0n);

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(0);

        // lp token locked
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(pairAddress);
        expect(outMessage.tokensLocked[0].amount).to.be.equal(lpMintedAmount);

    });

    it ("Test swapExactTokensForTokens", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test swapExactTokensForTokens");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "swapExactTokensForTokens(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMTokenAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const amountIn = 10n * 10n**9n;

        // get calculated amounts out
        const amountsOut = await uniswapV2Router02.getAmountsOut(amountIn, [await sttonToken.getAddress(), await tacToken.getAddress()]);

        const amountOutMin = amountsOut[1];

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amountIn,
        }

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ["tuple(uint256,uint256,address[],address,uint256)"],
            [
                [   amountIn,
                    amountOutMin,
                    [sttonEVMTokenAddress, tacEVMTokenAddress],
                    target,
                    deadline
                ]
            ]
        )

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [sttonTokenMintInfo],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(1);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(await tacToken.getAddress());
        expect(outMessage.tokensBurned[0].amount).to.be.equal(amountOutMin);

        expect(outMessage.tokensLocked.length).to.be.equal(0);
    });

    it ("Test swapTokensForExactTokens", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test swapTokensForExactTokens");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "swapTokensForExactTokens(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMTokenAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const amountInMax = 10n * 10n**9n;

        // get calculated amounts out
        const amountsOut = await uniswapV2Router02.getAmountsOut(amountInMax, [await sttonToken.getAddress(), await tacToken.getAddress()]);

        const amountOut = amountsOut[1];

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amountInMax,
        }

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ["tuple(uint256,uint256,address[],address,uint256)"],
            [
                [
                    amountOut,
                    amountInMax,
                    [sttonEVMTokenAddress, tacEVMTokenAddress],
                    target,
                    deadline,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [sttonTokenMintInfo],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(1);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(await tacToken.getAddress());
        expect(outMessage.tokensBurned[0].amount).to.be.equal(amountOut);

        expect(outMessage.tokensLocked.length).to.be.equal(0);

    });

    it ("Test swapExactTokensForETH", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test swapExactTokensForETH");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "swapExactTokensForETH(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        const amountIn = 500n * 10n**9n;

        // get calculated amounts out
        const amountsOut = await uniswapV2Router02.getAmountsOut(amountIn, [await sttonToken.getAddress(), await wTAC.getAddress()]);
        const amountOutMin = amountsOut[1];

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            amount: amountIn,
        }

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256, uint256, address[], address, uint256)'],
            [
                [
                    amountIn,
                    amountOutMin,
                    [sttonEVMTokenAddress, await wTAC.getAddress()],
                    target,
                    deadline,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [sttonTokenMintInfo],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(0);

        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(testSdk.getNativeTokenAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amountOutMin);
    });

    it ("Test removeLiquidity", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test removeLiquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "removeLiquidity(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMTokenAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        const pairAddress = await uniswapV2Factory.getPair(await sttonToken.getAddress(), await tacToken.getAddress());
        const lpToken = (new ethers.Contract(pairAddress, uniswapPairArtifact.abi, admin)) as unknown as IUniswapV2Pair;

        const liquidity = await lpToken.balanceOf(testSdk.getCrossChainLayerAddress());

        const lpTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: await lpToken.getAddress(),
            amount: liquidity,
        };

        const poolBalance0 = await sttonToken.balanceOf(pairAddress);
        const poolBalance1 = await tacToken.balanceOf(pairAddress);

        const lpTotalSupply = await lpToken.totalSupply();


        const sttonAmountMin = liquidity * poolBalance0 / lpTotalSupply;
        const tacAmountMin = liquidity * poolBalance1 / lpTotalSupply;

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ["tuple(address,address,uint256,uint256,uint256,address,uint256)"],
            [
                [
                    sttonEVMTokenAddress,
                    tacEVMTokenAddress,
                    liquidity,
                    sttonAmountMin,
                    tacAmountMin,
                    target,
                    deadline,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [lpTokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(2);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(await sttonToken.getAddress());
        expect(outMessage.tokensBurned[0].amount).gte(sttonAmountMin);
        expect(outMessage.tokensBurned[1].evmAddress).to.be.equal(await tacToken.getAddress());
        expect(outMessage.tokensBurned[1].amount).gte(tacAmountMin);

        expect(outMessage.tokensLocked.length).to.be.equal(0);
    });

    it ("Test removeLiquidityETH", async function () {

        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Test removeLiquidityETH");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp";

        const target = await uniswapV2Proxy.getAddress();
        const methodName = "removeLiquidityETH(bytes,bytes)";

        const sttonEVMTokenAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);

        const pairAddress = await uniswapV2Factory.getPair(await sttonToken.getAddress(), await wTAC.getAddress());
        const lpToken = (new ethers.Contract(pairAddress, uniswapPairArtifact.abi, admin)) as unknown as IUniswapV2Pair;

        const liquidity = await lpToken.balanceOf(testSdk.getCrossChainLayerAddress());

        const lpTokenUnlockInfo: TokenUnlockInfo = {
            evmAddress: await lpToken.getAddress(),
            amount: liquidity,
        };

        const poolBalance0 = await sttonToken.balanceOf(pairAddress);
        const poolBalance1 = await wTAC.balanceOf(pairAddress);

        const lpTotalSupply = await lpToken.totalSupply();

        const sttonAmountMin = liquidity * poolBalance0 / lpTotalSupply;
        const ethAmountMin = liquidity * poolBalance1 / lpTotalSupply;

        const deadline = 19010987500n;

        // encode arguments
        const encodedArguments = new ethers.AbiCoder().encode(
            ["tuple(address,uint256,uint256,uint256,address,uint256)"],
            [
                [
                    sttonEVMTokenAddress,
                    liquidity,
                    sttonAmountMin,
                    ethAmountMin,
                    target,
                    deadline,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [lpTokenUnlockInfo],
            0n,
            extraData,
            operationId,
            timestamp
        );

        // check out messages
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await uniswapV2Proxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");

        expect(outMessage.tokensBurned.length).to.be.equal(1);
        expect(outMessage.tokensBurned[0].evmAddress).to.be.equal(sttonEVMTokenAddress);
        expect(outMessage.tokensBurned[0].amount).gte(sttonAmountMin);

        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(testSdk.getNativeTokenAddress());
        expect(outMessage.tokensLocked[0].amount).gte(ethAmountMin);
    });
});