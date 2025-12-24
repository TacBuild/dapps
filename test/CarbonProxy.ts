import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { reset, setStorageAt } from "@nomicfoundation/hardhat-network-helpers"
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { deployCarbonProxy } from "../scripts/Carbon/deployProxy";
import { carbonMainnetConfig } from "../scripts/Carbon/config/mainnetConfig"
import { CarbonProxy, ISAFactory  } from "../typechain-types";
import {TAC_MAINNET_URL} from "../hardhat.config";

export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const usdtAddress = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f"
const ownerStorageSlotUsdt = BigInt("2")
const lBTCAddress = "0xecAc9C5F704e954931349Da37F60E39f515c11c1"
const ownerStorageSlotLbtc = BigInt("65173360639460082030725920392146925864023520599682862633725751242436743107328")
const saFactoryAddress = "0x070820Ed658860f77138d71f74EfbE173775895b"
const NATIVE_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

describe("Carbon Proxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSAFactory: ISAFactory;
    let carbonProxy: CarbonProxy;
    let usdt: any;
    let lBTC: any;
    let strategyId: string;
    let strategyIds: string[];
    let voucher: any;

    before(async function () {
        await reset(TAC_MAINNET_URL);
        
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(usdtAddress, ownerStorageSlotUsdt, await admin.getAddress());
        await setStorageAt(lBTCAddress, ownerStorageSlotLbtc, await admin.getAddress());

        tacSAFactory = new ethers.Contract(saFactoryAddress, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        carbonProxy = await deployCarbonProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress(), carbonMainnetConfig.carbonControllerAddress, carbonMainnetConfig.carbonBatcherAddress, carbonMainnetConfig.carbonVoucherAddress);
        usdt = new ethers.Contract(usdtAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
        lBTC = new ethers.Contract(lBTCAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)', 'function addMinter(address newMinter) external'], admin) as unknown;
        voucher = new ethers.Contract(carbonMainnetConfig.carbonVoucherAddress, ['function balanceOf(address) external view returns (uint256)'], admin) as unknown;
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

        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("20000", 6));
        await lBTC.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("0.2", 8));
        
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const baseToken = await lBTC.getAddress();
        const quoteToken = await usdt.getAddress();
        const order: Array<[bigint,bigint,bigint,bigint]> = [
            [16000000n, 1480465677n, 276335970240068n, 5139006470588n],
            [20000000000n, 31968270820n, 1925342742061687n, 422212465065984n],
          ];
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['address','address','tuple(uint128,uint128,uint64,uint64)[2]'],
            [baseToken, quoteToken, order]
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
        expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
        expect(await lBTC.balanceOf(userAddress)).to.be.eq(0);
        expect(await usdt.balanceOf(target)).to.be.eq(0);
        expect(await lBTC.balanceOf(target)).to.be.eq(0);

        let abi = [
            "event StrategyCreated(uint256 indexed strategyId, address indexed user, string indexed tvmWalletCaller)"
        ];

        const carbonProxyEvent = new ethers.Contract(await carbonProxy.getAddress(), abi, admin);
        const eventFilter = carbonProxyEvent.filters.StrategyCreated
        const events = await carbonProxyEvent.queryFilter(eventFilter, -1);
        
        const event = events[0] as unknown as { args: { strategyId: string } };
        strategyId = event.args.strategyId
        expect(strategyId).to.not.be.null;


    });

    it("Carbon proxy update strategy, add liquidity", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("updateStrategy");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "updateStrategy(bytes,bytes)";

        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("60000", 6));
        await lBTC.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("0.9", 8));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

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

        expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
        expect(await lBTC.balanceOf(userAddress)).to.be.eq(0);
        expect(await usdt.balanceOf(target)).to.be.eq(0);
        expect(await lBTC.balanceOf(target)).to.be.eq(0);

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

        expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
        expect(await lBTC.balanceOf(userAddress)).to.be.eq(0);
        expect(await usdt.balanceOf(target)).to.be.eq(0);
        expect(await lBTC.balanceOf(target)).to.be.eq(0);

    });

    it("Trade by source amount", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("tradeBySourceAmount");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await carbonProxy.getAddress();
        const methodName = "tradeBySourceAmount(bytes,bytes)";

        await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("1000", 6));

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

        const targetToken = await lBTC.getAddress();
        const sourceToken = await usdt.getAddress();
        const deadline = ethers.MaxUint256;
        const minReturn = ethers.parseUnits("0.00001", 8);
        const tradeActions : Array<[bigint,bigint]> = [
            [BigInt(strategyId), ethers.parseUnits("1000", 6)],
        ];

        

          
          
          const encodedArguments = new ethers.AbiCoder().encode(
            ['address','address','tuple(uint256,uint128)[]','uint256','uint128'],
            [sourceToken, targetToken, tradeActions, deadline, minReturn]
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
        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);

        // check lp token locked
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await lBTC.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

    });

    
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
            ['address','address','tuple(uint256,uint128)[]','uint256','uint128'],
            [sourceToken, targetToken, tradeActions, deadline, maxInput]
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

        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(2);

        // check lp token locked
        expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(await lBTC.getAddress());
        expect(outMessage.tokensLocked[1].amount).to.be.eq(ethers.parseUnits("0.001", 8));

    });

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
            ['uint256'],
            [strategyId]
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
        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(2);
        expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await lBTC.getAddress());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0);
        expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(await usdt.getAddress());
        expect(outMessage.tokensLocked[1].amount).to.be.gt(0);

    });


    it("Carbon proxy create strategy with native token", async function () {
      const shardsKey = 2n;
      const operationId = ethers.encodeBytes32String("createStrategy 2");
      const extraData = "0x";
      const timestamp = BigInt(Math.floor(Date.now() / 1000));
      const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

      const target = await carbonProxy.getAddress();
      const methodName = "createStrategy(bytes,bytes)";

      await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("120000", 6));
      const tx = await admin.sendTransaction({
        to: await carbonProxy.getAddress(),
        value: ethers.parseUnits("1000", 18)
      })
      await tx.wait();
      
      
      const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

      const baseToken = NATIVE_ADDRESS;
      const quoteToken = await usdt.getAddress();
      const order: Array<[bigint,bigint,bigint,bigint]> = [
          [1000000000000000000000n, 2677518557547884418481n, 5505270407005458n, 5819312065461623n],
          [1000000000n, 1843038983n, 116590753n, 281474976n],
        ];
        const nativeTokenAddress = testSdk.getNativeTokenAddress();
        
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
      expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
      expect(await ethers.provider.getBalance(userAddress)).to.be.eq(0);
      expect(await usdt.balanceOf(target)).to.be.eq(0);
      expect(await ethers.provider.getBalance(target)).to.be.eq(0);

      let abi = [
          "event StrategyCreated(uint256 indexed strategyId, address indexed user, string indexed tvmWalletCaller)"
      ];

      const carbonProxyEvent = new ethers.Contract(await carbonProxy.getAddress(), abi, admin);
      const eventFilter = carbonProxyEvent.filters.StrategyCreated
      const events = await carbonProxyEvent.queryFilter(eventFilter, -1);
      
      const event = events[0] as unknown as { args: { strategyId: string } };
      strategyId = event.args.strategyId
      expect(strategyId).to.not.be.null;


  });

  it("Carbon proxy update strategy, add liquidity", async function () {
    const shardsKey = 2n;
    const operationId = ethers.encodeBytes32String("updateStrategy 2");
    const extraData = "0x";
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

    const target = await carbonProxy.getAddress();
    const methodName = "updateStrategy(bytes,bytes)";

    await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("1000", 6));
    const tx = await admin.sendTransaction({
      to: await carbonProxy.getAddress(),
      value: ethers.parseUnits("1000", 18)
    })
    await tx.wait();

    const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

    const OldOrder: Array<[bigint,bigint,bigint,bigint]> = [
      [1000000000000000000000n, 2677518557547884418481n, 5505270407005458n, 5819312065461623n],
      [1000000000n, 1843038983n, 116590753n, 281474976n],
    ];

      const NewOrder: Array<[bigint,bigint,bigint,bigint]> = [
        [2000000000000000000000n, 5355037115095768836963n, 5505270407005458n, 5819312065461623n],
        [2000000000n, 3686077967n, 116590753n, 281474976n],
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

    expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
    expect(await ethers.provider.getBalance(userAddress)).to.be.eq(0);
    expect(await usdt.balanceOf(target)).to.be.eq(0);
    expect(await ethers.provider.getBalance(target)).to.be.eq(0);

});


it("Carbon proxy update strategy, remove liquidity", async function () {
  const shardsKey = 2n;
  const operationId = ethers.encodeBytes32String("updateStrategy 2");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

  const target = await carbonProxy.getAddress();
  const methodName = "updateStrategy(bytes,bytes)";

  

  const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

  const NewOrder: Array<[bigint,bigint,bigint,bigint]> = [
    [1000000000000000000000n, 2677518557547884418481n, 5505270407005458n, 5819312065461623n],
    [1000000000n, 1843038983n, 116590753n, 281474976n],
  ];

    const OldOrder: Array<[bigint,bigint,bigint,bigint]> = [
      [2000000000000000000000n, 5355037115095768836963n, 5505270407005458n, 5819312065461623n],
      [2000000000n, 3686077967n, 116590753n, 281474976n],
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

  expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
  expect(await ethers.provider.getBalance(userAddress)).to.be.eq(0);
  expect(await usdt.balanceOf(target)).to.be.eq(0);
  expect(await ethers.provider.getBalance(target)).to.be.eq(0);

  const outMessage = outMessages[0];
      expect(outMessage.tokensLocked.length).to.be.equal(2);

        // check lp token locked
      expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await usdt.getAddress());

});

it("Trade by source amount", async function () {
  const shardsKey = 2n;
  const operationId = ethers.encodeBytes32String("tradeBySourceAmount 2");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

  const target = await carbonProxy.getAddress();
  const methodName = "tradeBySourceAmount(bytes,bytes)";

  await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("1000", 6));

  const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

  const targetToken = NATIVE_ADDRESS;
  const sourceToken = await usdt.getAddress();
  const deadline = ethers.MaxUint256;
  const minReturn = ethers.parseUnits("1", 18);
  const tradeActions : Array<[bigint,bigint]> = [
      [BigInt(strategyId), ethers.parseUnits("10", 6)],
  ];

  

    
    
    const encodedArguments = new ethers.AbiCoder().encode(
      ['address','address','tuple(uint256,uint128)[]','uint256','uint128'],
      [sourceToken, targetToken, tradeActions, deadline, minReturn]
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
  const outMessage = outMessages[0];
  expect(outMessage.tokensLocked.length).to.be.equal(2);

  // check lp token locked
  expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(NATIVE_ADDRESS);
  expect(outMessage.tokensLocked[1].amount).to.be.gt(0);

  expect(await usdt.balanceOf(userAddress)).to.be.eq(0);
  expect(await ethers.provider.getBalance(userAddress)).to.be.eq(0);
  expect(await usdt.balanceOf(target)).to.be.eq(0);
  expect(await ethers.provider.getBalance(target)).to.be.eq(0);

});

it("Trade by target amount", async function () {
  const shardsKey = 1n;
  const operationId = ethers.encodeBytes32String("tradeByTargetAmount 2");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

  const target = await carbonProxy.getAddress();
  const methodName = "tradeByTargetAmount(bytes,bytes)";

  await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("10000", 6));

  const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await carbonProxy.getAddress())

  const targetToken = NATIVE_ADDRESS;
  const sourceToken = await usdt.getAddress();
  const deadline = ethers.MaxUint256;
  const maxInput = ethers.parseUnits("1000", 6);
  const tradeActions : Array<[bigint,bigint]> = [
      [BigInt(strategyId), ethers.parseUnits("100", 18)],
  ];

  

    
    
    const encodedArguments = new ethers.AbiCoder().encode(
      ['address','address','tuple(uint256,uint128)[]','uint256','uint128'],
      [sourceToken, targetToken, tradeActions, deadline, maxInput]
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

  const outMessage = outMessages[0];
  expect(outMessage.tokensLocked.length).to.be.equal(2);

  // check lp token locked
  expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(NATIVE_ADDRESS);
  expect(outMessage.tokensLocked[1].amount).to.be.eq(ethers.parseUnits("100", 18));

});

it("Delete strategy", async function () {
  const shardsKey = 1n;
  const operationId = ethers.encodeBytes32String("deleteStrategy 2");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

  const target = await carbonProxy.getAddress();
  const methodName = "deleteStrategy(bytes,bytes)";


  const targetToken = NATIVE_ADDRESS;
  const sourceToken = await usdt.getAddress();
  

    
    
    const encodedArguments = new ethers.AbiCoder().encode(
      ['uint256'],
      [strategyId]
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
  const outMessage = outMessages[0];
  expect(outMessage.tokensLocked.length).to.be.equal(2);
  expect(outMessage.tokensLocked[1].evmAddress).to.be.equal(NATIVE_ADDRESS);
  expect(outMessage.tokensLocked[1].amount).to.be.gt(0);
  expect(outMessage.tokensLocked[0].evmAddress).to.be.equal(await usdt.getAddress());
  expect(outMessage.tokensLocked[0].amount).to.be.gt(0);

});

it("Batch create strategy", async function () {
  const shardsKey = 1n;
  const operationId = ethers.encodeBytes32String("batchCreateStrategy");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

  const target = await carbonProxy.getAddress();
  const methodName = "batchCreate(bytes,bytes)";


  const baseToken = await lBTC.getAddress();
        
  const quoteToken = await usdt.getAddress();
  const order: Array<[bigint,bigint,bigint,bigint]> = [
            [16000000n, 1480465677n, 276335970240068n, 5139006470588n],
            [20000000000n, 31968270820n, 1925342742061687n, 422212465065984n],
          ];

          const tx = await admin.sendTransaction({
            to: await carbonProxy.getAddress(),
            value: ethers.parseUnits("1000", 18)
          })
          await tx.wait();
          
          
    
          const baseToken1 = NATIVE_ADDRESS;
          const quoteToken1 = await usdt.getAddress();
          const order1: Array<[bigint,bigint,bigint,bigint]> = [
              [1000000000000000000000n, 2677518557547884418481n, 5505270407005458n, 5819312065461623n],
              [1000000000n, 1843038983n, 116590753n, 281474976n],
            ];
  
          await usdt.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("2000000", 6));
          await lBTC.connect(admin).mint(await carbonProxy.getAddress(), ethers.parseUnits("10", 8));


    
    
    const encodedArguments = new ethers.AbiCoder().encode(
      ["tuple(address[2],tuple(uint128,uint128,uint64,uint64)[2])[]"],
      [[[[baseToken, quoteToken], order], [[baseToken1, quoteToken1], order1]]]
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
    "event StrategyCreatedBatch(uint256[] strategyIds, address indexed user, string tvmWalletCaller)"
];

const carbonProxyEvent = new ethers.Contract(await carbonProxy.getAddress(), abi, admin);
const eventFilter = carbonProxyEvent.filters.StrategyCreatedBatch
const events = await carbonProxyEvent.queryFilter(eventFilter, -1);

const event = events[0] as unknown as { args: { strategyIds: string[] } };
strategyIds = event.args.strategyIds
expect(strategyIds).to.not.be.null;

});

it("Transfer strategy", async function () {
  const shardsKey = 1n;
  const operationId = ethers.encodeBytes32String("transferStrategy 2");
  const extraData = "0x";
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
  const receiver = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2J3";

  const target = await carbonProxy.getAddress();
  const methodName = "transferStrategy(bytes,bytes)";
  const userAddress1 = await tacSAFactory.getSmartAccountForApplication(tvmWalletCaller, await carbonProxy.getAddress())
  const receiverAddress = await tacSAFactory.getSmartAccountForApplication(receiver, await carbonProxy.getAddress())
  const balanceUser1Before = await voucher.balanceOf(userAddress1)
  const balanceReceiverBefore = await voucher.balanceOf(receiverAddress)
  expect(balanceUser1Before).to.be.eq(2);
  expect(balanceReceiverBefore).to.be.eq(0);

    
    const encodedArguments = new ethers.AbiCoder().encode(
      ['uint256', 'string'],
      [strategyIds[0], receiver]
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

  const balanceUser1After = await voucher.balanceOf(userAddress1)
  const balanceReceiverAfter = await voucher.balanceOf(receiverAddress)
  expect(balanceUser1After).to.be.eq(1);
  expect(balanceReceiverAfter).to.be.eq(1);

});



    
    
});