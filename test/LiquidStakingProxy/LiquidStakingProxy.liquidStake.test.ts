import { expect } from "chai";
import { ethers } from "hardhat";
import { parseEther } from "ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import {
  deployLiquidStakingProxy,
  ZERO_BN,
} from "./LiquidStakingProxy.fixture.test";
import { LiquidStakingProxy } from "../../typechain-types";
import { sendMessage } from "./LiquidStakingProxy.helpers.test";

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

describe("Method: liquidStake: ", () => {
  const TVM_CALLER = "TVM-USER-1";
  const STAKE_AMOUNT = parseEther("1");

  let ownerAccount: SignerWithAddress;

  let testSdk: TacLocalTestSdk;

  before(async () => {
    [ownerAccount] = await ethers.getSigners();

    testSdk = new TacLocalTestSdk();
  });

  async function deployFixture(): Promise<LiquidStakingProxy> {
    const contracts = await deployLiquidStakingProxy(testSdk, ownerAccount);
    return contracts.liquidStakingProxy;
  }

  describe("When one of parameters is incorrect", () => {
    describe("When the caller is not a cross chain contract", () => {
      it("should revert with OnlyCrossChainLayer", async () => {
        const liquidStakingProxy = await loadFixture(deployFixture);

        await expect(
          liquidStakingProxy.connect(ownerAccount).liquidStake("0x", "0x")
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxy,
            "OnlyCrossChainLayer"
          )
          .withArgs();
      });
    });

    describe("When the passed amount equal zero", () => {
      it("should revert with InvalidAmount", async () => {
        const liquidStakingProxy = await loadFixture(deployFixture);

        const encoded = abiCoder.encode(["uint256"], [ZERO_BN]);

        await expect(
          sendMessage(
            testSdk,
            TVM_CALLER,
            liquidStakingProxy.target as string,
            "liquidStake(bytes,bytes)",
            encoded,
            ZERO_BN
          )
        ).to.be.rejectedWith(/ProxyCallError: custom error 0x2c5211c6/); // InvalidAmount()
      });
    });
  });

  describe("When all parameters correct", () => {
    let liquidStakingProxy: LiquidStakingProxy;
    let encoded: string;

    before(async () => {
      liquidStakingProxy = await loadFixture(deployFixture);
      encoded = abiCoder.encode(["uint256"], [STAKE_AMOUNT]);
    });

    it("should success", async () => {
      await sendMessage(
        testSdk,
        TVM_CALLER,
        liquidStakingProxy.target as string,
        "liquidStake(bytes,bytes)",
        encoded,
        STAKE_AMOUNT
      );
    });
  });
});
