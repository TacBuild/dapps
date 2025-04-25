import hre from "hardhat";
import { deployMockOracle } from "./MockOracleDeploy";
import { IMetaMorpho, IMorpho, IMorphoVault, MorphoProxy } from "../../typechain-types";
import type { IERC20 } from "../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20";
import { TacSdk, Network, AssetBridgingData, EvmProxyMsg, SenderFactory } from '@tonappchain/sdk';

async function main() {
    const morpho = await hre.ethers.getContractAt("IMorpho", "0xF0453e7368Ea01d6d6d6a222C26B5a06F1d816e9") as unknown as IMorpho;
    const metaMorpho = await hre.ethers.getContractAt("IMetaMorpho", "0xAD03a229163cBc902992C10F8Ea279C11A4d6f27") as unknown as IMetaMorpho;
    const morphoProxy = await hre.ethers.getContractAt("MorphoProxy", "0xd3e1AEf84Ac1fadfc9CE7b98641F09291A13957f") as unknown as MorphoProxy;
    const morphoVault = await hre.ethers.getContractAt("IMorphoVault", "0x752165E0098205C576f15bEB1158E3bAe4db2192") as unknown as IMorphoVault;
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY || "", hre.ethers.provider!);
    
    console.log(await morphoVault.asset());
    const asset = await hre.ethers.getContractAt("@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol:IERC20Metadata", await morphoVault.asset()) as unknown
    console.log("deployer.address",deployer.address);
    
    console.log(await asset.balanceOf(deployer.address));
    console.log(await asset.decimals());

    // await bridgeTokens();



    // const tvmTokenAddress = await getTokenAddresses();
    // console.log(tvmTokenAddress);
    
    
    // let tx = await asset.connect(deployer).approve(morphoVault.target, ethers.MaxUint256);
    // await tx.wait();
    // console.log("Approved");
    
    // tx = await morphoVault.connect(deployer).deposit(1n, deployer.address);
    // await tx.wait();
    // console.log("Deposited");

    await crosschainDeposit();

    

    // tx = await morphoProxy.connect(deployer).createVault(ethers.encodeBytes32String("Create vault"), encodedArguments);
    // await tx.wait();
    // console.log("Vault created");

    // const mockOracle = await deployMockOracle(deployer);
    // console.log("MockOracle deployed to:", await mockOracle.getAddress());
    // let tx = await morpho.connect(deployer).createMarket({
        // loanToken: "0x3178d6Aa9Dcb112b36b80C9Eb5860Ea55ab2EA45",
        // collateralToken: "0xB849c9361667B0CeB9FB262C4A5931b827fda836",
        // oracle: mockOracle.target,
        // irm: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
        // lltv: hre.ethers.parseEther("0.945")
    // });
    // await tx.wait();
    // tx = await metaMorpho.connect(deployer).createMetaMorpho(deployer.address, 0n, "0x3178d6Aa9Dcb112b36b80C9Eb5860Ea55ab2EA45", "Morpho TT1/TT1 V2", "tt1/tt2V2", ethers.encodeBytes32String("Morpho TON/USDT"));
    // await tx.wait();
    // console.log(tx);
    
    // const morphoVault = new ethers.Contract("0x752165E0098205C576f15bEB1158E3bAe4db2192", hre.artifacts.readArtifactSync('IMorphoVault').abi, deployer) as unknown as IMorphoVault;
    // let tx = await morphoVault.connect(deployer).setCurator(await deployer.getAddress());
    // await tx.wait();
    // console.log("Curator set to:", await deployer.getAddress());
        
    // tx = await morphoVault.connect(deployer).setFeeRecipient(await deployer.getAddress());
    // await tx.wait();
    // console.log("Fee recipient set to:", await deployer.getAddress());
    // tx = await morphoVault.connect(deployer).setIsAllocator(await deployer.getAddress(), true);
    // await tx.wait();
    // console.log("Is allocator set to:", true);
    // tx = await morphoVault.connect(deployer).submitCap(
    //     {
    //             loanToken: "0x3178d6Aa9Dcb112b36b80C9Eb5860Ea55ab2EA45",
    //             collateralToken: "0xB849c9361667B0CeB9FB262C4A5931b827fda836",
    //             oracle: "0x49534D46C8f7c83E96Ea9B9370AeAF56B0011870",
    //             irm: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
    //             lltv: hre.ethers.parseEther("0.945")
    //         },
    //         ethers.parseEther("100")
    //     );
    //     await tx.wait();
    //     console.log("Cap submitted");
    //     const marketParamsId = computeMarketParamsId({
    //         loanToken: "0x3178d6Aa9Dcb112b36b80C9Eb5860Ea55ab2EA45",
    //         collateralToken: "0xB849c9361667B0CeB9FB262C4A5931b827fda836",
    //         oracle: "0x49534D46C8f7c83E96Ea9B9370AeAF56B0011870",
    //         irm: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
    //         lltv: hre.ethers.parseEther("0.945")
    //     });
    //     console.log("Market params id:", marketParamsId);

    //     tx = await morphoVault.connect(deployer).acceptCap(
    //         {
    //             loanToken: "0x3178d6Aa9Dcb112b36b80C9Eb5860Ea55ab2EA45",
    //             collateralToken: "0xB849c9361667B0CeB9FB262C4A5931b827fda836",
    //             oracle: "0x49534D46C8f7c83E96Ea9B9370AeAF56B0011870",
    //             irm: "0x172FF09b5E3be27139f3ABF4820DeF486e7E9838",
    //             lltv: hre.ethers.parseEther("0.945")
    //         }
    //     );
    //     await tx.wait();
    //     console.log("Cap accepted");
    //     tx = await morphoVault.connect(deployer).setSupplyQueue(
    //         [marketParamsId]
    //     );
    //     await tx.wait();
    //     console.log("Supply queue set");

    // const morphoProxyFactory = await hre.ethers.getContractFactory("MorphoProxy", deployer);

    // let proxy =await hre.upgrades.upgradeProxy("0xd3e1AEf84Ac1fadfc9CE7b98641F09291A13957f", morphoProxyFactory);
    // await proxy.waitForDeployment();
    // console.log("MorphoProxy upgraded");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

interface MarketParams {
    loanToken: string;
    collateralToken: string;
    oracle: string;
    irm: string;
    lltv: BigInt;
  }


function computeMarketParamsId(params: MarketParams): string {
    // Convert each address to 32 bytes and numbers to a 32-byte hex string
    const loanToken = ethers.zeroPadValue(params.loanToken, 32);
    const collateralToken = ethers.zeroPadValue(params.collateralToken, 32);
    const oracle = ethers.zeroPadValue(params.oracle, 32);
    const irm = ethers.zeroPadValue(params.irm, 32);
    const lltv = ethers.zeroPadValue(
      ethers.toBeHex(params.lltv.toString()),
      32
    );
  
    // Concatenate all the parameters
    const concatenatedParams =
      loanToken +
      collateralToken.slice(2) +
      oracle.slice(2) +
      irm.slice(2) +
      lltv.slice(2);
  
    // Compute the Keccak256 hash
    return ethers.keccak256(concatenatedParams);
  }


  async function getTokenAddresses() {
  const tacSdk = await TacSdk.create({
    network: Network.TESTNET
  });
  
  // Get EVM address for a TON token
  const tonTokenAddress = "EQCsQSo54ajAorOfDUAM-RPdDJgs0obqyrNSEtvbjB7hh2oK";
  const evmTokenAddress = await tacSdk.getEVMTokenAddress(tonTokenAddress);
  console.log(`TON token ${tonTokenAddress} maps to EVM token ${evmTokenAddress}`);
  
  // Get TON address for an EVM token
  const tacTokenAddress = "0x9d7Ed9FC634DA176F201A67D31dBD5591fc35572";
  const tvmTokenAddress = await tacSdk.getTVMTokenAddress(tacTokenAddress);
  console.log(`EVM token ${tacTokenAddress} maps to TON token ${tvmTokenAddress}`);
  
  return  tvmTokenAddress ;
} 

async function bridgeTokens() {

    const evmProxyMsg: EvmProxyMsg = {
        evmTargetAddress: "0x440E079445AA9586bf99971d5f57BF09E2B9A403",
    };

    const tacSdk = await TacSdk.create({
      network: Network.TESTNET
    });
    
    const mnemonic = process.env.TVM_MNEMONICS || ''; // 24 words mnemonic
    const sender = await SenderFactory.getSender({
        network: Network.TESTNET,
        version: 'V3R2',
        mnemonic,
    });

    
    // Bridge a single token
    const assets: AssetBridgingData[] = [
      {
        address: "EQBLi0v_y-KiLlT1VzQJmmMbaoZnLcMAHrIEmzur13dwOmM1", // TON token address
        amount: 1 // User-friendly amount
      }
    ];
    
    // Send a transaction with bridged tokens
    const transactionLinker = await tacSdk.sendCrossChainTransaction(
      evmProxyMsg,
      sender,
      assets,
    );
    
    return transactionLinker;
  }

  async function crosschainDeposit() {

    const evmProxyMsg : EvmProxyMsg = {
        evmTargetAddress: "0xd3e1AEf84Ac1fadfc9CE7b98641F09291A13957f",
        methodName: 'deposit(bytes,bytes)',
        encodedParameters: new ethers.AbiCoder().encode(
          ['tuple(address,uint256)'],
          [[
            '0x752165E0098205C576f15bEB1158E3bAe4db2192', // vault address
            ethers.parseUnits('1', 9n) // tt1
          ]]
        )
      };
      console.log(evmProxyMsg);
      
    const tacSdk = await TacSdk.create({
      network: Network.TESTNET
    });
    
    const mnemonic = process.env.TVM_MNEMONICS || ''; // 24 words mnemonic
    const sender = await SenderFactory.getSender({
        network: Network.TESTNET,
        version: 'V3R2',
        mnemonic,
    });

    
    // Bridge a single token
    const assets: AssetBridgingData[] = [
      {
        address: "EQBLi0v_y-KiLlT1VzQJmmMbaoZnLcMAHrIEmzur13dwOmM1", // TON token address
        amount: 1 // User-friendly amount
      }
    ];
    
    // Send a transaction with bridged tokens
    const transactionLinker = await tacSdk.sendCrossChainTransaction(
      evmProxyMsg,
      sender,
      assets,
    );
    
    return transactionLinker;
  }

