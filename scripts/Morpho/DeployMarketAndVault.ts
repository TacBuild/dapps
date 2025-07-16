import hre from "hardhat";
import { morphoMainnetConfig, morphoMainnetProxyDeployments } from "./config/mainnetConfig";
import { IMorpho, IMetaMorphoV1_1Factory, IMorphoVault } from "../../typechain-types";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const morpho = new ethers.Contract(morphoMainnetConfig.morphoAddress, hre.artifacts.readArtifactSync('IMorpho').abi, deployer) as unknown as IMorpho;
    const metaMorphoV1_1 = new ethers.Contract(morphoMainnetConfig.metaMorphoV1_1Address, hre.artifacts.readArtifactSync('IMetaMorphoV1_1Factory').abi, deployer) as unknown as IMetaMorphoV1_1Factory;


    // 0x0FACa06594C8d5Bd9eA61D2bb68C0B3676674563 лада
    // 0x057B5219486e8cbDfef65a0f090ad72b2D8Fc81D бмв

    const market = {
        loanToken: "0x0FACa06594C8d5Bd9eA61D2bb68C0B3676674563",
        collateralToken: "0x057B5219486e8cbDfef65a0f090ad72b2D8Fc81D",
        oracle: "0x79a6a379aEf8017B05983A2d6195Ab5f5069e514",
        irm: morphoMainnetConfig.lrmAddress,
        lltv: ethers.parseEther("0.86")
    }

    let tx = await morpho.createMarket(market);
    await tx.wait();
    console.log("Market created");

    // tx = await metaMorphoV1_1.createMetaMorpho(
    //     await deployer.getAddress(),
    //     0n,
    //     "0x0FACa06594C8d5Bd9eA61D2bb68C0B3676674563",
    //     "Lada_Bmw_Deviation_1000",
    //     "LBMW_1000_V2",
    //     ethers.encodeBytes32String("1x")
    // );
    // await tx.wait();
    // console.log("MetaMorpho created");


        const morphoVault = new ethers.Contract("0x97a9Ce0c463F8855191a4181dCA264Dd02028649", hre.artifacts.readArtifactSync('IMorphoVault').abi, deployer) as unknown as IMorphoVault;
    //     let tx = await morphoVault.connect(deployer).setCurator(await deployer.getAddress());
    //     await tx.wait();
    //     console.log("Curator set");
        
    // tx = await morphoVault.connect(deployer).setFeeRecipient(await deployer.getAddress());
    // await tx.wait();
    // console.log("Fee recipient set");
    // tx = await morphoVault.connect(deployer).setIsAllocator(await deployer.getAddress(), true);
    // await tx.wait();
    // console.log("Is allocator set");
    tx = await morphoVault.connect(deployer).submitCap(
        market,
            ethers.parseUnits("10000", 18)
        );
        await tx.wait();
        console.log("Cap submitted");
        const marketParamsId = computeMarketParamsId(market);
        console.log("Market params id", marketParamsId);
        tx = await morphoVault.connect(deployer).acceptCap(
            market
        );
        await tx.wait();
        console.log("Cap accepted");
        tx = await morphoVault.connect(deployer).setSupplyQueue(
            [marketParamsId]
        );
        await tx.wait();
        console.log("Supply queue set");
}

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

main()
