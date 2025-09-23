import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import {
  LiquidStakingProxy,
  LiquidStakingProxy__factory,
} from "../../typechain-types";
import {
  deployLiquidStakingDependencies,
  LiquidStakingDependencies,
  ZERO_ADDRESS,
} from "./LiquidStakingProxy.fixture.test";

describe("Method: initialize: ", () => {
  let ownerAccount: SignerWithAddress;
  let owner: string;
  let liquidStakingProxyFactory: LiquidStakingProxy__factory;
  let liquidStakingProxy: LiquidStakingProxy;

  let testSdk: TacLocalTestSdk;

  before(async () => {
    [ownerAccount] = await ethers.getSigners();
    owner = ownerAccount.address;

    testSdk = new TacLocalTestSdk();
    liquidStakingProxyFactory = await ethers.getContractFactory(
      "LiquidStakingProxy"
    );
  });

  async function deployFixture(): Promise<LiquidStakingDependencies> {
    const dependencies = await deployLiquidStakingDependencies(
      testSdk,
      ownerAccount
    );
    return dependencies;
  }

  describe("When one of parameters is incorrect", () => {
    describe("When cross chain layer is zero address", () => {
      it("should revert with InvalidAddress", async () => {
        const { saFactoryAddress, gTACContract } = await loadFixture(
          deployFixture
        );

        await expect(
          liquidStakingProxyFactory.deploy(
            ZERO_ADDRESS,
            saFactoryAddress,
            gTACContract.target,
            owner
          )
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxyFactory,
            "InvalidAddress"
          )
          .withArgs();
      });
    });

    describe("When smart-account factory is zero address", () => {
      it("should revert with InvalidAddress", async () => {
        const { crossChainLayerAddress, gTACContract } = await loadFixture(
          deployFixture
        );

        await expect(
          liquidStakingProxyFactory.deploy(
            crossChainLayerAddress,
            ZERO_ADDRESS,
            gTACContract.target,
            owner
          )
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxyFactory,
            "InvalidAddress"
          )
          .withArgs();
      });
    });

    describe("When liquid staking token is zero address", () => {
      it("should revert with InvalidAddress", async () => {
        const { crossChainLayerAddress, saFactoryAddress } = await loadFixture(
          deployFixture
        );

        await expect(
          liquidStakingProxyFactory.deploy(
            crossChainLayerAddress,
            saFactoryAddress,
            ZERO_ADDRESS,
            owner
          )
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxyFactory,
            "InvalidAddress"
          )
          .withArgs();
      });
    });

    describe("When owner is zero address", () => {
      it("should revert with OwnableInvalidOwner", async () => {
        const { crossChainLayerAddress, saFactoryAddress, gTACContract } =
          await loadFixture(deployFixture);

        await expect(
          liquidStakingProxyFactory.deploy(
            crossChainLayerAddress,
            saFactoryAddress,
            gTACContract.target,
            ZERO_ADDRESS
          )
        )
          .to.be.revertedWithCustomError(
            liquidStakingProxyFactory,
            "OwnableInvalidOwner"
          )
          .withArgs(ZERO_ADDRESS);
      });
    });
  });

  describe("When all parameters correct", () => {
    let liquidStakingProxyDependencies: LiquidStakingDependencies;

    before(async () => {
      liquidStakingProxyDependencies = await loadFixture(deployFixture);
    });

    it("should success", async () => {
      liquidStakingProxy = await liquidStakingProxyFactory.deploy(
        liquidStakingProxyDependencies.crossChainLayerAddress,
        liquidStakingProxyDependencies.saFactoryAddress,
        liquidStakingProxyDependencies.gTACContract.target,
        owner
      );
    });

    it("should smart-account factory address be equal to expected", async () => {
      expect(await liquidStakingProxy.saFactory()).to.equal(
        liquidStakingProxyDependencies.saFactoryAddress
      );
    });

    it("should liquid staking token be equal to expected", async () => {
      expect(await liquidStakingProxy.liquidTacToken()).to.equal(
        liquidStakingProxyDependencies.gTACContract.target
      );
    });

    it("should owner be equal to expected", async () => {
      expect(await liquidStakingProxy.owner()).to.equal(owner);
    });
  });
});
