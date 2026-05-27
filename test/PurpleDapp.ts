import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import {reset, setStorageAt, setBalance} from "@nomicfoundation/hardhat-network-helpers"

import { JettonInfo, TacLocalTestSdk, TokenMintInfo, TokenUnlockInfo, } from "@tonappchain/evm-ccl";
import { tacTokenInfo } from '../scripts/test/TokensInfo';
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { PurpleDapp, LpFactory } from "../typechain-types";
import { deployPurpleDapp } from "../scripts/Purple/deployPurpleDapp";
import { TacSdk, Network, AgnosticProxySDK, AgnosticStructs } from "@tonappchain/sdk";
import {TAC_TESTNET_SPB_URL} from "../hardhat.config";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
export const AGNOSTIC_PROXY_ADDRESS = "0x0000000000000000000000000000000000000000";
export const JFK_ADDRESS = "0x6988C476CA404d59e9F368F0d14D1a74b49D0443";
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

let jfkTVAddress: string;
const AGNOSTIC_PROXY_STORAGE_LOCATION_OF_CROSS_CHAIN_LAYER = "0x9b777d7f09ca6843192b146ee41249650756fb313cbc428aa2dd37d610f1d100";

describe("PurpleDapp", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let purpleDapp: PurpleDapp;
    let lpFactory: LpFactory;
    let agnosticProxySDK: AgnosticProxySDK;
    let JFK: any;
    let JFK_TOKEN_INFO: JettonInfo;
    let stton: ERC20;
    before(async function () {
        await reset(TAC_TESTNET_SPB_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        
        agnosticProxySDK = new AgnosticProxySDK(Network.TESTNET);
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(agnosticProxySDK.getAgnosticCallParams().evmTargetAddress, AGNOSTIC_PROXY_STORAGE_LOCATION_OF_CROSS_CHAIN_LAYER, crossChainLayerAddress);

        const purpleDappObj = await deployPurpleDapp(admin);
        purpleDapp = purpleDappObj.purpleDapp;
        lpFactory = purpleDappObj.purpleFactory;
        agnosticProxySDK.addContractInterface(await purpleDapp.getAddress(), hre.artifacts.readArtifactSync('PurpleDapp').abi);
        const realSdk = await TacSdk.create({
            network: Network.TESTNET
        });
        jfkTVAddress = await realSdk.getTVMTokenAddress(JFK_ADDRESS);
        JFK_TOKEN_INFO = {
            tvmAddress: jfkTVAddress,
            name: "John F. Kennedy International Airport",
            symbol: "JFK",
            decimals: 9n
        };
        JFK = new ethers.Contract(JFK_ADDRESS, ["function mint(address to, uint256 amount)", "function balanceOf(address account) view returns (uint256)", "function decimals() view returns (uint8)", "function approve(address spender, uint256 amount)", "function transfer(address to, uint256 amount) returns (bool)", "function name() view returns (string memory)", "function symbol() view returns (string memory)"], admin) as unknown as any;
        
        await setStorageAt(JFK_ADDRESS, 2, await admin.getAddress());
        await JFK.connect(admin).mint(await admin.getAddress(), ethers.parseEther("1000"));
    });

    it("Mint tokens and add liquidity", async function () {
        await JFK.connect(admin).approve(await purpleDapp.getAddress(), ethers.parseEther("1"));
        const lpTokenAddress = await purpleDapp.getLpTokenAddress(JFK_ADDRESS, jfkTVAddress);
        await purpleDapp.connect(admin).addLiquidity(JFK_ADDRESS, ethers.parseEther("1"), jfkTVAddress);
        const realLpTokenAddress = await lpFactory.getLpTokenAddress(JFK_ADDRESS, jfkTVAddress);
        expect(lpTokenAddress).to.be.equal(realLpTokenAddress)
        
        let lpTokenContract = new ethers.Contract(lpTokenAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        expect(await lpTokenContract.name()).to.be.equal("Purple-LP-" + JFK_TOKEN_INFO.tvmAddress);
        expect(await lpTokenContract.symbol()).to.be.equal("PPL-LP-" + JFK_TOKEN_INFO.tvmAddress.slice(0, 4));
        expect(await lpTokenContract.decimals()).to.be.equal(9);
    });

    it("Mint native and add liquidity native token", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Add native liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const agnosticCallParams = agnosticProxySDK.getAgnosticCallParams()
        const realSdk = await TacSdk.create({
            network: Network.TESTNET
        });
        const smartAccountAddress = await realSdk.getSmartAccountAddressForTvmWallet(tvmWalletCaller, agnosticCallParams.evmTargetAddress);
        const hooks = []
        const lpTokenAddress = await purpleDapp.getLpTokenAddress(NATIVE_TOKEN_ADDRESS, tacTokenInfo.tvmAddress);
        hooks.push(
            encodeRawTransferNative(false, smartAccountAddress, ethers.parseUnits("1", 18))
        )
        hooks.push(agnosticProxySDK.createCustomHook(
            await purpleDapp.getAddress(),
            "addLiquidity",
            [NATIVE_TOKEN_ADDRESS, ethers.parseEther("1"), tacTokenInfo.tvmAddress],
            {
                isFromSAPerspective: true,
                value: ethers.parseEther("1")
            }
        ));
        hooks.push(agnosticProxySDK.createFullBalanceTransferHook(lpTokenAddress, agnosticCallParams.evmTargetAddress, true));
        const zapCall = agnosticProxySDK.buildZapCall(hooks, [lpTokenAddress], []);
        const zapCallData = agnosticProxySDK.encodeZapCall(zapCall);

        await setBalance(agnosticCallParams.evmTargetAddress, ethers.parseEther("1"));

        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            agnosticCallParams.evmTargetAddress,
            agnosticCallParams.methodName,
            zapCallData,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(lpTokenAddress);
        expect(outMessage.tokensLocked[0].amount).to.be.equal(ethers.parseEther("1"));
        let lpTokenContract = new ethers.Contract(lpTokenAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        expect(await lpTokenContract.name()).to.be.equal("Purple-LP-" + tacTokenInfo.tvmAddress);
        expect(await lpTokenContract.symbol()).to.be.equal("PPL-LP-" + tacTokenInfo.tvmAddress.slice(0, 4));
        expect(await lpTokenContract.decimals()).to.be.equal(18);
    });

    it("Remove liquidity", async function () {
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const agnosticCallParams = agnosticProxySDK.getAgnosticCallParams()
        const realSdk = await TacSdk.create({
            network: Network.TESTNET
        });

        const lpTokenAddress = await purpleDapp.getLpTokenAddress(JFK_ADDRESS, jfkTVAddress);
        const lpTokenContract = new ethers.Contract(lpTokenAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        const lpTokenBalance = await lpTokenContract.balanceOf(admin);
        expect(lpTokenBalance).to.be.equal(ethers.parseEther("1"));
        await purpleDapp.connect(admin).removeLiquidity(JFK_ADDRESS, ethers.parseEther("1"), jfkTVAddress);
        expect(await lpTokenContract.balanceOf(admin)).to.be.equal(0);
    });

    it("Remove liquidity native token", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("Remove native liquidity");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
        const agnosticCallParams = agnosticProxySDK.getAgnosticCallParams()
        const realSdk = await TacSdk.create({
            network: Network.TESTNET
        });
        const smartAccountAddress = await realSdk.getSmartAccountAddressForTvmWallet(tvmWalletCaller, agnosticCallParams.evmTargetAddress);

        const hooks = []
        const lpTokenAddress = await purpleDapp.getLpTokenAddress(NATIVE_TOKEN_ADDRESS, tacTokenInfo.tvmAddress);
        hooks.push(agnosticProxySDK.createFullBalanceTransferHook(lpTokenAddress, smartAccountAddress, false));
        hooks.push(agnosticProxySDK.createCustomHook(
            await purpleDapp.getAddress(),
            "removeLiquidity",
            [NATIVE_TOKEN_ADDRESS, ethers.parseEther("1"), tacTokenInfo.tvmAddress],
            {
                isFromSAPerspective: true
            }
        ));
        hooks.push(encodeRawTransferNative(true, agnosticCallParams.evmTargetAddress, ethers.parseEther("1")));
        const zapCall = agnosticProxySDK.buildZapCall(hooks, [ethers.ZeroAddress], []);
        const zapCallData = agnosticProxySDK.encodeZapCall(zapCall);

        const unlockTokens: TokenUnlockInfo[] = [
            {
                evmAddress: lpTokenAddress,
                amount: ethers.parseEther("1")
            }
        ];
        
        const {receipt, outMessages} = await testSdk.sendMessage(
            shardsKey,
            agnosticCallParams.evmTargetAddress,
            agnosticCallParams.methodName,
            zapCallData,
            tvmWalletCaller,
            [],
            unlockTokens,
            0n,
            extraData,
            operationId,
            timestamp
        );

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(NATIVE_TOKEN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.equal(ethers.parseEther("1"));

    });
});

function encodeRawTransferNative(isFromSAPerspective: boolean, contractAddress: string, value: bigint) {
    const encodedHookData = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(bool,address,uint256,bytes,bytes)'],
        [
            [
                isFromSAPerspective,
                contractAddress,
                value,
                "0x",
                "0x",
            ],
        ],
    );

    return {
        hookType: AgnosticStructs.HookType.Custom,
        hookData: encodedHookData,
    };
}