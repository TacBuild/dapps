import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { reset, getStorageAt, setStorageAt } from "@nomicfoundation/hardhat-network-helpers"
import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { deployCarbonProxy } from "../scripts/Carbon/deployProxy";
import { carbonMainnetConfig } from "../scripts/Carbon/config/mainnetConfig"
import { CarbonProxy, ISAFactory  } from "../typechain-types";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const usdtAddress = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const ownerStorageSlotUsdt = BigInt("2")
const lBTCAddress = "0xecAc9C5F704e954931349Da37F60E39f515c11c1"
const ownerStorageSlotLbtc = BigInt("65173360639460082030725920392146925864023520599682862633725751242436743107328")
const saFactoryAddress = "0x070820Ed658860f77138d71f74EfbE173775895b"

let usdtAbi = [
    
]

type Order = {
    y: bigint;
    z: bigint;
    A: bigint;
    B: bigint;
}


describe("Carbon Proxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSAFactory: ISAFactory;
    let carbonProxy: CarbonProxy;
    let usdt: any;
    let lBTC: any;
    let strategyId: string;
    

    before(async function () {
        await reset(process.env.TAC_MAINNET_URL, 3818195);
        
        

        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        console.log(await getStorageAt(usdtAddress, ownerStorageSlotUsdt));
        console.log(await getStorageAt(lBTCAddress, ownerStorageSlotLbtc));
        await setStorageAt(usdtAddress, ownerStorageSlotUsdt, await admin.getAddress());
        await setStorageAt(lBTCAddress, ownerStorageSlotLbtc, await admin.getAddress());
        console.log(await getStorageAt(usdtAddress, ownerStorageSlotUsdt));
        console.log(await getStorageAt(lBTCAddress, ownerStorageSlotLbtc));
        
        tacSAFactory = new ethers.Contract(saFactoryAddress, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        carbonProxy = await deployCarbonProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress(), carbonMainnetConfig.carbonControllerAddress);
        usdt = new ethers.Contract(usdtAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        lBTC = new ethers.Contract(lBTCAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)', 'function addMinter(address newMinter) external'], admin) as unknown;        
        await lBTC.connect(admin).addMinter(await admin.getAddress());
        
    });

    it("Carbon proxy create strategy", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("createStrategy");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "createStrategy(bytes,bytes)";

        console.log(await usdt.balanceOf(await admin.getAddress()));
        console.log(await lBTC.balanceOf(await admin.getAddress()));
        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("20000", 6));
        await lBTC.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("0.2", 8));
        console.log(await usdt.balanceOf(await admin.getAddress()));
        console.log(await lBTC.balanceOf(await admin.getAddress()));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const baseToken = await lBTC.getAddress();
        const quoteToken = await usdt.getAddress();
        const order: Array<[bigint,bigint,bigint,bigint]> = [
            [16000000n, 1480465677n, 276335970240068n, 5139006470588n],
            [20000000000n, 31968270820n, 1925342742061687n, 422212465065984n],
          ];
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,tuple(uint128,uint128,uint64,uint64)[2])'],
            [[baseToken, quoteToken, order]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        let abi = [
            "event StrategyCreated(uint256 indexed strategyId, address indexed user, string indexed tvmWalletCaller)"
        ];

        const carbonProxyEvent = new ethers.Contract(await carbonProxy.getAddress(), abi, admin);
        const eventFilter = carbonProxyEvent.filters.StrategyCreated
        const events = await carbonProxyEvent.queryFilter(eventFilter, -1);
        
        const event = events[0] as unknown as { args: { strategyId: string } };
        strategyId = event.args.strategyId
        console.log(strategyId)

    });

    it("Carbon proxy update strategy, add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("updateStrategy");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "updateStrategy(bytes,bytes)";

        console.log(await usdt.balanceOf(await admin.getAddress()));
        console.log(await lBTC.balanceOf(await admin.getAddress()));
        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("60000", 6));
        await lBTC.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("0.9", 8));
        console.log(await usdt.balanceOf(await admin.getAddress()));
        console.log(await lBTC.balanceOf(await admin.getAddress()));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const baseToken = await lBTC.getAddress();
        const quoteToken = await usdt.getAddress();
        const OldOrder: Array<[bigint,bigint,bigint,bigint]> = [
            [16000000n, 1480465677n, 276335970240068n, 5139006470588n],
            [20000000000n, 31968270820n, 1925342742061687n, 422212465065984n],
          ];

          const NewOrder: Array<[bigint,bigint,bigint,bigint]> = [
            [50000000n, 4626455243n, 276335970240068n, 5139006470588n],
            [60000000000n, 95904812462n, 1925342742061687n, 422212465065984n],
          ];
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,tuple(uint128,uint128,uint64,uint64)[2],tuple(uint128,uint128,uint64,uint64)[2])'],
            [[strategyId, OldOrder, NewOrder]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

    });


    it("Carbon proxy update strategy, remove liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("updateStrategy");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "updateStrategy(bytes,bytes)";

        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const baseToken = await lBTC.getAddress();
        const quoteToken = await usdt.getAddress();

        const OldOrder: Array<[bigint,bigint,bigint,bigint]> = [
            [50000000n, 4626455243n, 276335970240068n, 5139006470588n],
            [60000000000n, 95904812462n, 1925342742061687n, 422212465065984n],
          ];
        const NewOrder: Array<[bigint,bigint,bigint,bigint]> = [
            [16000000n, 1480465677n, 276335970240068n, 5139006470588n],
            [20000000000n, 31968270820n, 1925342742061687n, 422212465065984n],
          ];

          
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,tuple(uint128,uint128,uint64,uint64)[2],tuple(uint128,uint128,uint64,uint64)[2])'],
            [[strategyId, OldOrder, NewOrder]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

    });

    it("Trade by source amount", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("tradeBySourceAmount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "tradeBySourceAmount(bytes,bytes)";

        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("10000", 6));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const targetToken = await lBTC.getAddress();
        const sourceToken = await usdt.getAddress();
        const deadline = ethers.MaxUint256;
        const minReturn = ethers.parseUnits("0.00001", 8);
        const tradeActions : Array<[bigint,bigint]> = [
            [BigInt(strategyId), ethers.parseUnits("1000", 6)],
        ];

        

          
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,tuple(uint256,uint128)[],uint256,uint128)'],
            [[sourceToken, targetToken, tradeActions, deadline, minReturn]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

    });

    // TODO
    it("Trade by target amount", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("tradeByTargetAmount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "tradeByTargetAmount(bytes,bytes)";

        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("10000", 6));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const targetToken = await lBTC.getAddress();
        const sourceToken = await usdt.getAddress();
        const deadline = ethers.MaxUint256;
        const maxInput = ethers.parseUnits("10000", 6);
        const tradeActions : Array<[bigint,bigint]> = [
            [BigInt(strategyId), ethers.parseUnits("0.001", 8)],
        ];

        

          
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(address,address,tuple(uint256,uint128)[],uint256,uint128)'],
            [[sourceToken, targetToken, tradeActions, deadline, maxInput]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

    });

    // TODO
    it("Delete strategy", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deleteStrategy");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "deleteStrategy(bytes,bytes)";



        const targetToken = await lBTC.getAddress();
        const sourceToken = await usdt.getAddress();
        

          
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['tuple(uint256,address,address)'],
            [[strategyId, targetToken, sourceToken]]
          );

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            encodedArguments,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

    });

    
    
});