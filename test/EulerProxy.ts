import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { SaHooksBuilder } from "../scripts/TacSmartAccountFactory/SDK/SaHooksSDK";
import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { deployEulerProxy } from "../scripts/Euler/EulerProxyDeploy";
import { EulerProxy, ISAFactory  } from "../typechain-types";
import { EulerLensAbi } from "./abis/EulerLensAbi";


export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const vaultAddress = "0x8d5f39a9149a2cb04f9e48c1c95a36b36aa51def";
const borrowVaultAddress = "0x4b2e3a2dc6536235196e5a48d430ff8c66e6b4d6"
const assetAddress = "0x990e64388db00eff7a9c9f01c3748d5401df5082";
const borrowAssetAddress = "0x3B0DE40DdCAa337CEBc1ba435c77c656AF286CA8";
const ETH_VAULT_CONNECTOR = "0x272911fC4a3Cae478F29d13df85127f9a556B36D";
const PERMIT_2_ADDRESS = "0x63079e13441219D3Acf1012269127EBf304616D8";
const LENS_ADDRESS = "0xC477C2D033A43d5fDE3DB0c948bf7170b72F29B0"

interface IBorrowVault {
  debtOf(account: string): Promise<bigint>;
  touch(): Promise<void>;
}

interface ILens {
  getVaultAccountInfo(account: string, vault: string): Promise<string>;
}

describe("EulerProxy", function () {
    let admin: Signer;
    let testSdk: TacLocalTestSdk;
    let tacSAFactory: ISAFactory;
    let eulerProxy: EulerProxy;
    let asset: ERC20;
    let borrowAsset: ERC20;
    

    before(async function () {
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        const crossChainLayerAddress = await testSdk.create(ethers.provider);
        
        tacSAFactory = new ethers.Contract(testSdk.getSmartAccountFactoryAddress(), hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        eulerProxy = await deployEulerProxy(admin, crossChainLayerAddress, await tacSAFactory.getAddress(), await admin.getAddress());
        asset = new ethers.Contract(assetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        borrowAsset = new ethers.Contract(borrowAssetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;        
        
    });

    it("Euler deposit test", async function () {
        const shardsKey = 1n;
        const operationId = ethers.encodeBytes32String("deposit");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("20", 6);
        hooks.addContractInterface(vaultAddress, [
            'function deposit(uint256,address) external',
          ])
        hooks.addContractInterface(PERMIT_2_ADDRESS, [
            'function approve(address,address,uint160,uint48) external',
          ])

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, amount])
          hooks.addPreHookCallFromSelf(assetAddress, 'transfer', [userAddress, amount])
          const callString = "tuple(address,address,uint256,bytes)"
          const dataForCall = hooks.getDataForCall(vaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString(), callString], [hooks.build(), [[vaultAddress]], [vaultAddress, userAddress, 0n, dataForCall]])
          await asset.connect(admin).transfer(await eulerProxy.getAddress(), amount)        

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
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
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((vaultAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0n);
    });

    it("Euler deposit to borrow vault test", async function () {
        const shardsKey = 3n;
        const operationId = ethers.encodeBytes32String("deposit_to_borrow_vault");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "call(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const amount = ethers.parseUnits("10", 18);
        hooks.addContractInterface(borrowVaultAddress, [
            'function deposit(uint256,address) external',
          ])
        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(borrowAssetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(borrowAssetAddress, 'approve', [borrowVaultAddress, amount])
          hooks.addPreHookCallFromSelf(borrowAssetAddress, 'transfer', [userAddress, amount])
          const callString = "tuple(address,address,uint256,bytes)"
          const dataForCall = hooks.getDataForCall(borrowVaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString(), callString], [hooks.build(), [[borrowVaultAddress]], [borrowVaultAddress, userAddress, 0n, dataForCall]])
          await borrowAsset.connect(admin).transfer(await eulerProxy.getAddress(), amount)        

        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
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
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((borrowVaultAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0n);
    });

    it("Euler borrow test with subaccount", async function () {
        const shardsKey = 4n;
        const operationId = ethers.encodeBytes32String("borrow");
        const extraData = "0x";
        const timestamp = BigInt(Math.floor(Date.now() / 1000));
        const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";

        const target = await eulerProxy.getAddress();
        const methodName = "batch(bytes,bytes)";
        const hooks = new SaHooksBuilder()
        const depositAmount = ethers.parseUnits("50", 6);
        const amount = ethers.parseUnits("0.001", 18);
        await asset.connect(admin).transfer(await eulerProxy.getAddress(), depositAmount)        

        hooks.addContractInterface(vaultAddress, [
            'function transfer(address,uint256) external',
            'function deposit(uint256,address) external',
          ])

          hooks.addContractInterface(borrowAssetAddress, [
            'function transfer(address,uint256) external',
            'function deposit(uint256,address) external',
          ])

        hooks.addContractInterface(borrowVaultAddress, [
            "function borrow(uint256 amount, address receiver) external returns (uint256)",
          ])
        hooks.addContractInterface(ETH_VAULT_CONNECTOR, [
            "function enableCollateral(address account, address vault) external payable",
            "function enableController(address account, address vault) external payable",
          ])
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        

        
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
        const subAccount1 = getSubAccount(userAddress, 1);
        const depositData = hooks.getDataForCall(vaultAddress, 'deposit', [depositAmount, subAccount1])
        const borrowData = hooks.getDataForCall(borrowVaultAddress, 'borrow', [amount, userAddress])
        const controllerData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'enableController', [subAccount1, borrowVaultAddress])
        const collateralData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'enableCollateral', [subAccount1, vaultAddress])
        const batchString = "tuple(address,address,uint256,bytes)[]"
        const batchItems = [
          [vaultAddress, userAddress, 0n, depositData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, controllerData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, collateralData],
          [borrowVaultAddress, subAccount1, 0n, borrowData],
        ]
        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, depositAmount])
          hooks.addPreHookCallFromSelf(assetAddress, 'transfer', [userAddress, depositAmount])


          
          hooks.addPostHookCallFromSA(borrowAssetAddress, 'transfer', [await eulerProxy.getAddress(), amount])

          const callData = new ethers.AbiCoder().encode(
            [hooks.tupleString(), hooks.bridgeString(), batchString],
            [hooks.build(), [[borrowAssetAddress]], batchItems]
          )

          const borrowVault = new ethers.Contract(borrowVaultAddress, [
            "function debtOf(address) external view returns (uint256)",
            "function touch() external"
          ], admin) as unknown as IBorrowVault;
          const debtBefore = await borrowVault.debtOf(subAccount1);
          expect(debtBefore).to.be.equal(0n);
        const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
            shardsKey,
            target,
            methodName,
            callData,
            tvmWalletCaller,
            [],
            [],
            0n,
            extraData,
            operationId,
            timestamp
        );

        const debtAfter = await borrowVault.debtOf(subAccount1);
        expect(debtAfter).to.be.gt(0n);
        const outMessage = outMessages[0];
        expect(outMessage.tokensLocked.length).to.be.equal(1);
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((borrowAssetAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.equal(amount);
    });


    it("Euler repay test", async function () {
      const shardsKey = 5n;
      const operationId = ethers.encodeBytes32String("repay");
      const extraData = "0x";
      const timestamp = BigInt(Math.floor(Date.now() / 1000)+ 10);
      const tvmWalletCaller = "EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk";
      const target = await eulerProxy.getAddress();
      const methodName = "batch(bytes,bytes)";
      const hooks = new SaHooksBuilder()
      const amount = ethers.parseEther("0.001")
      const withdrawAmount = ethers.parseUnits("25", 6);

        hooks.addContractInterface(borrowAssetAddress, [
          'function approve(address,uint256) external',
          'function transfer(address,uint256) external',
        ])
      hooks.addContractInterface(assetAddress, [
        'function transfer(address,uint256) external',
      ])

      hooks.addContractInterface(borrowVaultAddress, [
          "function repay(uint256 amount, address receiver) external returns (uint256)",
          "function debtOf(address) external view returns (uint256)"
        ])
      hooks.addContractInterface(vaultAddress, [
        "function transferFrom(address,address,uint256) external",
        'function withdraw(uint256,address,address) external',
        'function redeem(uint256,address,address) external'
      ])
      hooks.addContractInterface(ETH_VAULT_CONNECTOR, [
          "function disableCollateral(address account, address vault) external payable",
          "function disableController(address account) external payable",
        ])
      await borrowAsset.connect(admin).transfer(await eulerProxy.getAddress(), ethers.parseEther("1"))        

      
      const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
      const subAccount1 = getSubAccount(userAddress, 1);
      const lens = new ethers.Contract(LENS_ADDRESS, EulerLensAbi, admin) as unknown as ILens;
      const vaultAccountInfo = await lens.getVaultAccountInfo(subAccount1, borrowVaultAddress);
        // const vaultAccountInfoDecoded = decodeVaultAccountInfo(vaultAccountInfo);
        expect(vaultAccountInfo[7]).to.be.gt(0);
      
      
      

        const repayData = hooks.getDataForCall(borrowVaultAddress, 'repay', [ethers.MaxUint256, subAccount1])
        const controllerData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'disableController', [subAccount1])
        const collateralData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'disableCollateral', [subAccount1, vaultAddress])
        const withdrawData = hooks.getDataForCall(vaultAddress, 'withdraw', [withdrawAmount, await eulerProxy.getAddress(), subAccount1])
        const batchString = "tuple(address,address,uint256,bytes)[]"
        const batchItems = [
          [borrowVaultAddress, userAddress, 0n, repayData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, controllerData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, collateralData],
          [vaultAddress, subAccount1, 0n, withdrawData],
        ]

        hooks.addPreHookCallFromSA(borrowAssetAddress, 'approve', [borrowVaultAddress, ethers.MaxUint256])
        hooks.addPreHookCallFromSelf(borrowAssetAddress, 'transfer', [userAddress, ethers.parseEther("0.01")])
    
        const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString(), batchString], [hooks.build(), [[assetAddress]], batchItems])


        const unlockInfo : TokenUnlockInfo = {
          evmAddress: borrowAssetAddress,
          amount: amount
        }
      

      const {receipt, deployedTokens, outMessages} = await testSdk.sendMessage(
          shardsKey,
          target,
          methodName,
          callData,
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
        expect((outMessage.tokensLocked[0].evmAddress).toString().toLowerCase()).to.be.equal((assetAddress).toLowerCase());
        expect(outMessage.tokensLocked[0].amount).to.be.gt(0n);
  });
    
});


export function getSubAccount(primary: string, subAccountId: number | string) {
  if (parseInt(subAccountId as string) !== subAccountId || subAccountId > 256)
    throw `invalid subAccountId: ${subAccountId}`
  const subAccount = BigInt(primary) ^ BigInt(subAccountId)
  return ethers.zeroPadValue(
    ethers.toBeHex(subAccount, 20),
    20,
  )
}

export interface BatchItem {
  targetContract: string;
  onBehalfOfAccount: string;
  value: bigint;
  data: string;
}