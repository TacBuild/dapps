import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { SaHooksBuilder } from "./utils/SaHooksSDK";
import { TacLocalTestSdk, TokenUnlockInfo} from "@tonappchain/evm-ccl";
import { ERC20 } from "@tonappchain/evm-ccl/dist/typechain-types";
import { upgradeEulerProxy } from "../scripts/Euler/EulerUpgrade";
import { EulerProxy, ISAFactory  } from "../typechain-types";
import { EulerLensAbi } from "./abis/EulerLensAbi";
import { reset, setStorageAt } from "@nomicfoundation/hardhat-network-helpers"
import { eulerConfig } from "../scripts/Euler/EulerConfig";



export const MAXUINT128 = BigInt("340282366920938463463374607431768211455");
const vaultAddress = "0xdD6EaEf38F94d4724124cEc14c819818714537Ff";
const borrowVaultAddress = "0x73475c15FE4Cb39AD0c58Cb520E7A5771Ae8fC44"
const assetAddress = "0xAF988C3f7CB2AceAbB15f96b19388a259b6C438f";
const borrowAssetAddress = "0x61D66bC21fED820938021B06e9b2291f3FB91945";
const ETH_VAULT_CONNECTOR = "0x01F594c66A5561b90Bc782dD0297f294cD668b64";
const PERMIT_2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const LENS_ADDRESS = "0x8A3b3E493733e54977B539A4E475Bf16463ecBD6"
const TAC_SA_FACTORY_ADDRESS = "0x070820Ed658860f77138d71f74EfbE173775895b";

const FINAL_MESSAGE = 'By proceeding to engage with and use Euler, you accept and agree to abide by the Terms of Use: https://www.euler.finance/terms  hash:0x1a7aa1916b6c56272b62be027108c06d9af95eef4dac46acbc80267b3919e07e'
const FINAL_HASH = '0xb0d552b4ebe441d9582f5fc732fd6026b09bec13e7f3c1e21c0ecaa3801df595'
const SIGN_CONTRACT_ADDRESS = '0x03C4A1b8b860Dd98fB3fc03c8D693EAbABC667c5'

const PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER = "0x9b777d7f09ca6843192b146ee41249650756fb313cbc428aa2dd37d610f1d100"
const PROXY_STORAGE_SLOT_OWNER = "0x9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c199300"
const PROXY_ADDRESS = eulerConfig.eulerProxyMainnetAddress;
const ownerStorageSlotUsdt = 2n // asset
const ERC20_BALANCE_STORAGE_SLOT = "0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00"


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
    let usdt: any;
    let crossChainLayerAddress: string;
    

    before(async function () {
      await reset(process.env.TAC_MAINNET_URL);
        [admin] = await ethers.getSigners();
        testSdk = new TacLocalTestSdk();
        crossChainLayerAddress = await testSdk.create(ethers.provider);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_CROSS_CHAIN_LAYER, crossChainLayerAddress);
        await setStorageAt(PROXY_ADDRESS, PROXY_STORAGE_SLOT_OWNER, await admin.getAddress());
        
        tacSAFactory = new ethers.Contract(TAC_SA_FACTORY_ADDRESS, hre.artifacts.readArtifactSync('ISAFactory').abi, admin) as unknown as ISAFactory;
        eulerProxy = await upgradeEulerProxy();
        asset = new ethers.Contract(assetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;
        borrowAsset = new ethers.Contract(borrowAssetAddress, hre.artifacts.readArtifactSync('ERC20').abi, admin) as unknown as ERC20;        
        usdt = new ethers.Contract(assetAddress, ['function mint(address,uint256) external', 'function balanceOf(address) external view returns (uint256)'], admin) as unknown;
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
        const amount = ethers.parseUnits("2000", 6);
        await usdtMint(await eulerProxy.getAddress(), amount, admin, crossChainLayerAddress, usdt);
        hooks.addContractInterface(vaultAddress, [
            'function deposit(uint256,address) external',
          ])
        hooks.addContractInterface(PERMIT_2_ADDRESS, [
            'function approve(address,address,uint160,uint48) external',
          ])

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, amount])
          hooks.addPreHookTransferTo(assetAddress, userAddress, amount)
          const callString = "tuple(address,address,uint256,bytes)"
          const dataForCall = hooks.getDataForCall(vaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
      
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString(), callString], [hooks.build(), [[vaultAddress]], [vaultAddress, userAddress, 0n, dataForCall]])

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
        const amount = ethers.parseUnits("100", 9);
        await setERC20Balance(borrowAssetAddress, await eulerProxy.getAddress(), amount, ERC20_BALANCE_STORAGE_SLOT);
        hooks.addContractInterface(borrowVaultAddress, [
            'function deposit(uint256,address) external',
          ])
        

        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
          hooks.addContractInterface(borrowAssetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        
          hooks.addPreHookCallFromSA(borrowAssetAddress, 'approve', [borrowVaultAddress, amount])
          hooks.addPreHookTransferTo(borrowAssetAddress, userAddress, amount)
          const callString = "tuple(address,address,uint256,bytes)"
          const dataForCall = hooks.getDataForCall(borrowVaultAddress, 'deposit', [amount, await eulerProxy.getAddress()])
          const callData = new ethers.AbiCoder().encode([hooks.tupleString(), hooks.bridgeString(), callString], [hooks.build(), [[borrowVaultAddress]], [borrowVaultAddress, userAddress, 0n, dataForCall]])

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
        const depositAmount = ethers.parseUnits("10000000", 6);
        await usdtMint(await eulerProxy.getAddress(), depositAmount, admin, crossChainLayerAddress, usdt);
        const amount = ethers.parseUnits("0.01", 9);

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
          hooks.addContractInterface(SIGN_CONTRACT_ADDRESS, [
            'function signTermsOfUse(string,bytes32) external',
          ])
      
          hooks.addContractInterface(assetAddress, ['function approve(address,uint256) external', 'function transfer(address,uint256) external'])        

        console.log("tvmWalletCaller", tvmWalletCaller);
        const userAddress = await tacSAFactory.predictSmartAccountAddress(tvmWalletCaller, await eulerProxy.getAddress())
        const subAccount1 = getSubAccount(userAddress, 1);
        console.log("2")
        const depositData = hooks.getDataForCall(vaultAddress, 'deposit', [depositAmount, subAccount1])
        const borrowData = hooks.getDataForCall(borrowVaultAddress, 'borrow', [amount, userAddress])
        const collateralData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'enableCollateral', [subAccount1, vaultAddress])
        const controllerData = hooks.getDataForCall(ETH_VAULT_CONNECTOR, 'enableController', [subAccount1, borrowVaultAddress])
        const signData = hooks.getDataForCall(SIGN_CONTRACT_ADDRESS, 'signTermsOfUse', [FINAL_MESSAGE, FINAL_HASH])
        const batchString = "tuple(address,address,uint256,bytes)[]"
        const batchItems = [
          [vaultAddress, userAddress, 0n, depositData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, controllerData],
          [ETH_VAULT_CONNECTOR, ethers.ZeroAddress, 0n, collateralData],
          [borrowVaultAddress, subAccount1, 0n, borrowData],
        ]
        batchItems.unshift([SIGN_CONTRACT_ADDRESS, userAddress, 0n, signData])
        
          hooks.addPreHookCallFromSA(assetAddress, 'approve', [vaultAddress, depositAmount])
          hooks.addPreHookTransferTo(assetAddress, userAddress, depositAmount)

        console.log("3")
          
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
          console.log("4")
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
        console.log("5")
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
      const amount = ethers.parseUnits("1", 9)
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
        await setERC20Balance(borrowAssetAddress, await eulerProxy.getAddress(), amount, ERC20_BALANCE_STORAGE_SLOT);
      
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
        hooks.addPreHookTransferTo(borrowAssetAddress, userAddress, ethers.parseEther("0.01"))
    
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

async function usdtMint(target: string, amount: bigint, signer: Signer, crossChainLayerAddress: string, usdt: any) {
  await setStorageAt(assetAddress, ownerStorageSlotUsdt, await signer.getAddress());
  await usdt.connect(signer).mint(target, amount);
  await setStorageAt(assetAddress, ownerStorageSlotUsdt, crossChainLayerAddress);
}

async function setERC20Balance(tokenAddress: string, userAddress: string, balance: bigint, slot: string) {
  const index = ethers.solidityPackedKeccak256(
    ["uint256", "uint256"],
    [userAddress, slot]
  );
  await setStorageAt(tokenAddress, index, ethers.toBeHex(balance, 32));
}