import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";

import { deployTacoProxy } from "../scripts/Taco/deployTacoProxy";
import { tacoTestnetConfig } from "../scripts/Taco/config/testnetConfig";
import { TacLocalTestSdk, TokenMintInfo } from "tac-l2-ccl";
import { sttonTokenInfo, tacTokenInfo } from '../scripts/common/info/tokensInfo';

import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { TacoProxy, IDODOV2Proxy01, IDODOFeeRouteProxy, IDVMFactory, IDODOApprove, IDVM } from "../typechain-types";

const dvmPoolAbi = hre.artifacts.readArtifactSync('IDVM').abi;

describe("TacoProxy", function () {
    let admin: Signer;

    let testSdk: TacLocalTestSdk;

    let tacoProxy: TacoProxy;
    let tacoV2Proxy02: IDODOV2Proxy01;
    let tacoDVMFactory: IDVMFactory;
    let tacoApprove: IDODOApprove;
    let tacoFeeRouteProxy: IDODOFeeRouteProxy;
    let tacoWETH: ERC20;

    let sttonToken: ERC20;
    let tacToken: ERC20;

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        tacoProxy = await deployTacoProxy(admin, tacoTestnetConfig, crossChainLayerAddress);

        tacoV2Proxy02 = new ethers.Contract(tacoTestnetConfig.tacoV2Proxy02, hre.artifacts.readArtifactSync('IDODOV2Proxy01').abi, admin) as unknown as IDODOV2Proxy01;
        tacoDVMFactory = new ethers.Contract(tacoTestnetConfig.tacoDVMFactory, hre.artifacts.readArtifactSync('IDVMFactory').abi, admin) as unknown as IDVMFactory;
        tacoApprove = new ethers.Contract(tacoTestnetConfig.tacoApprove, hre.artifacts.readArtifactSync('IDODOApprove').abi, admin) as unknown as IDODOApprove;
        tacoFeeRouteProxy = new ethers.Contract(tacoTestnetConfig.tacoFeeRouteProxy, hre.artifacts.readArtifactSync('IDODOFeeRouteProxy').abi, admin) as unknown as IDODOFeeRouteProxy;

        tacoWETH = new ethers.Contract(tacoTestnetConfig.tacoWETH, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
    });

    it ("TACO test add ERC20 DVM", async function () {
        const queryId = 1n;
        const operationId = ethers.encodeBytes32String("TACO test add ERC20 DVM");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await tacoProxy.getAddress();
        const methodName = "createDODOVendingMachine(bytes,bytes)";

        const sttonEVMAddress = testSdk.getEVMJettonAddress(sttonTokenInfo.tvmAddress);
        const tacEVMAddress = testSdk.getEVMJettonAddress(tacTokenInfo.tvmAddress);

        let pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);

        expect(pools.length).to.be.equal(0);

        const baseTokenDecimals = sttonTokenInfo.decimals;
        const quoteTokenDecimals = tacTokenInfo.decimals;

        const baseToken = sttonEVMAddress;
        const quoteToken = tacEVMAddress;

        const baseInAmount = 2000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;

        const sttonTokenMintInfo: TokenMintInfo = {
            info: sttonTokenInfo,
            mintAmount: baseInAmount,
        }
        const tacTokenMintInfo: TokenMintInfo = {
            info: tacTokenInfo,
            mintAmount: quoteInAmount,
        }

        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;

        const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)'],
            [
                [
                    baseToken,
                    quoteToken,
                    baseInAmount,
                    quoteInAmount,
                    lpFeeRate,
                    i,
                    k,
                    isOpenTWAP,
                    deadLine,
                ]
            ]
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            queryId, // queryId
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
        pools = await tacoDVMFactory.getDODOPool(sttonEVMAddress, tacEVMAddress);
        expect(pools.length).to.be.equal(1);

        const dvmPool = (new ethers.Contract(pools[0], dvmPoolAbi, admin)) as unknown as IDVM;

        // check pool balances
        expect(await sttonToken.balanceOf(await dvmPool.getAddress())).to.be.equal(baseInAmount);
        expect(await tacToken.balanceOf(await dvmPool.getAddress())).to.be.equal(quoteInAmount);

        const liquidity = await dvmPool.balanceOf(testSdk.getCrossChainLayerAddress());

        // check bridge lp back to user
        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.queryId).to.be.equal(queryId);
        expect(outMessage.callerAddress).to.be.equal(await tacoProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await dvmPool.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(liquidity);

    });


});
