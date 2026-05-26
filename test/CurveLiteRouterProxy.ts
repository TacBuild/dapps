import hre, { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { expect } from "chai";
import { setStorageAt, reset, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { upgradeCurveLiteRouterProxy } from "../scripts/CurveLite/deployRouterProxy";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { CurveLiteRouterProxy, ISAFactory } from "../typechain-types";

const USDT_ADDRESS = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const ownerStorageSlotUsdt = 2n
const PROXY_STORAGE_SLOT_OWNER = "0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300"
const PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER = "0x9b777d7f09ca6843192b146ee41249650756fb313cbc428aa2dd37d610f1d100"
const PROXY_ADDRESS = "0xADb2b2F9c73967B55FFc0fAF9fC1ddA3670a0689"
const USN_ADDRESS = "0x51A30E647D33A044967FA3DBb04d6ED6F45455F6"
const WTAC_ADDRESS = "0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9"
const poolUSDT_USN_ADDRESS = "0x24894f0c4f80837d61ca21730a75fa216fed7200"
const poolTAC_USDT_ADDRESS = "0xaad47973427b39be737c1154f50dd6595083fa88"
const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"
const TAC_SA_FACTORY_ADDRESS = "0x070820Ed658860f77138d71f74EfbE173775895b"


describe("CurveLiteRouterProxy", function () {
    let USDT: any
    let WTAC: any
    let USN: any
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let curveLiteRouterProxy: CurveLiteRouterProxy;
    let crossChainLayerAddress: string;
    let tacSaFactory: ISAFactory;
    let smartAccount: string;

    before(async function () {
        await reset(process.env.TAC_MAINNET_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER, crossChainLayerAddress);        
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_OWNER, await admin.getAddress());
        curveLiteRouterProxy = await upgradeCurveLiteRouterProxy();
        USDT = new ethers.Contract(USDT_ADDRESS, ["function mint(address,uint256) external", "function balanceOf(address) external view returns (uint256)"], admin) as unknown
        USN = new ethers.Contract(USN_ADDRESS, ["function balanceOf(address) external view returns (uint256)"], admin) as unknown;
        WTAC = new ethers.Contract(WTAC_ADDRESS, ["function deposit() external payable", "function transfer(address,uint256) external", "function balanceOf(address) external view returns (uint256)"], admin) as unknown;
        await setBalance(await admin.getAddress(), ethers.parseEther("100000000"));
        let tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk"
        tacSaFactory = new ethers.Contract(TAC_SA_FACTORY_ADDRESS, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        smartAccount = await tacSaFactory.getSmartAccountForApplication(tvmWalletCaller, await curveLiteRouterProxy.getAddress());

    });

    it ("Router exhange USDT to USN", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteRouterProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("10", 6);
        await usdtMint(await curveLiteRouterProxy.getAddress(), amount, admin, crossChainLayerAddress, USDT);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address[11],uint256[4][5],uint256,uint256,address)'],
            [
                [
                    [USDT_ADDRESS, poolUSDT_USN_ADDRESS, USN_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS,NULL_ADDRESS
                    ],
                    [[1, 0, 1, 10],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
                    amount,
                    0,
                    USN_ADDRESS
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USN.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);
        expect(await USN.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteRouterProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USN_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });


    it ("Router exhange USDT to WTAC", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteRouterProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseUnits("10", 6);
        await usdtMint(await curveLiteRouterProxy.getAddress(), amount, admin, crossChainLayerAddress, USDT);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address[11],uint256[4][5],uint256,uint256,address)'],
            [
                [
                    [USDT_ADDRESS, poolTAC_USDT_ADDRESS, WTAC_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS,NULL_ADDRESS
                    ],
                    [[0, 1, 1, 20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
                    amount,
                    0,
                    WTAC_ADDRESS
                ]
            ],
        );
        
        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await WTAC.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);
        expect(await WTAC.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteRouterProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteRouterProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(WTAC_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

    it ("Router exhange WTAC(erc20) to USDT", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("exchange");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await curveLiteRouterProxy.getAddress();
        const methodName = "exchange(bytes,bytes)";

        const amount = ethers.parseEther("998");
        await wtacSupply(await curveLiteRouterProxy.getAddress(), amount, admin, WTAC);

        const encodedParameters = new ethers.AbiCoder().encode(
            ['tuple(address[11],uint256[4][5],uint256,uint256,address)'],
            [
                [
                    [WTAC_ADDRESS, poolTAC_USDT_ADDRESS, USDT_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS, NULL_ADDRESS, NULL_ADDRESS,
                        NULL_ADDRESS,NULL_ADDRESS
                    ],
                    [[1, 0, 1, 20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
                    amount,
                    0,
                    USDT_ADDRESS
                ]
            ],
        );

        // send message
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey, // shardsKey
            target, // proxy address
            methodName, // method name
            encodedParameters, // encoded arguments
            tvmWalletCaller, // tvm caller
            [], // mint tokens
            [], // unlock tokens
            0n, // native tac amount to unlock
            extraData,
            operationId,
            timestamp
        );

        expect(await WTAC.balanceOf(smartAccount)).to.be.eq(0);
        expect(await USDT.balanceOf(smartAccount)).to.be.eq(0);
        expect(await WTAC.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);
        expect(await USDT.balanceOf(await curveLiteRouterProxy.getAddress())).to.be.eq(0);
        expect(await ethers.provider.getBalance(smartAccount)).to.be.eq(0);
        expect(await ethers.provider.getBalance(await curveLiteRouterProxy.getAddress())).to.be.eq(0);

        expect(outMessages.length).to.be.equal(1);
        const outMessage = outMessages[0];
        expect(outMessage.operationId).to.be.equal(operationId);
        expect(outMessage.shardsKey).to.be.equal(shardsKey);
        expect(outMessage.callerAddress).to.be.equal(await curveLiteRouterProxy.getAddress());
        expect(outMessage.targetAddress).to.be.equal(tvmWalletCaller);
        expect(outMessage.payload).to.be.equal("");
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(USDT_ADDRESS);
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
    });

});

  async function usdtMint(userAddress: string, amount: bigint, admin: Signer, crossChainLayerAddress: string, usdt: any) {
    await setStorageAt(USDT_ADDRESS, ownerStorageSlotUsdt, await admin.getAddress());
    await usdt.connect(admin).mint(userAddress, amount);
    await setStorageAt(USDT_ADDRESS, ownerStorageSlotUsdt, crossChainLayerAddress);
  }

  async function wtacSupply(userAddress: string, amount: bigint, admin: Signer, wtac: any) {
    await wtac.connect(admin).deposit({value: amount});
    await wtac.connect(admin).transfer(userAddress, amount);
  }
