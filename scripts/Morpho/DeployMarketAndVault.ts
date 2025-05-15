import hre from "hardhat";
import { morphoTestnetConfig, morphoProxyDeployments } from "./config/testnetConfig";
import { IMorpho, IMetaMorpho, IMorphoVault } from "../../typechain-types";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const morpho = new ethers.Contract(morphoTestnetConfig.morphoAddress, hre.artifacts.readArtifactSync('IMorpho').abi, deployer) as unknown as IMorpho;
    const metaMorphoV1_1 = new ethers.Contract(morphoTestnetConfig.metaMorphoV1_1Address, hre.artifacts.readArtifactSync('IMetaMorpho').abi, deployer) as unknown as IMetaMorpho;


    await morpho.createMarket({
        loanToken: "0x8b274AD9CC861eF360c779ce23B26fEb7595A40e",
        collateralToken: "0xc37412747c1000B7400cF9d3fdd905D2B0620B4C",
        oracle: morphoProxyDeployments.MockOracleAddress,
        irm: morphoTestnetConfig.lrmAddress,
        lltv: ethers.parseEther("0.945")
    });

    console.log(await metaMorphoV1_1.createMetaMorpho(
        await deployer.getAddress(),
        0n,
        "0x8b274AD9CC861eF360c779ce23B26fEb7595A40e",
        "TEST_VAULT",
        "TSTVLT",
        ethers.encodeBytes32String("0x")
    ));


        const morphoVault = new ethers.Contract("0x4C46008D989D2B7dd931c909bc7C0cC35Ab79829", hre.artifacts.readArtifactSync('IMorphoVault').abi, deployer) as unknown as IMorphoVault;
        let tx = await morphoVault.connect(deployer).setCurator(await deployer.getAddress());
        await tx.wait();
        console.log("Curator set");
        
    tx = await morphoVault.connect(deployer).setFeeRecipient(await deployer.getAddress());
    await tx.wait();
    console.log("Fee recipient set");
    tx = await morphoVault.connect(deployer).setIsAllocator(await deployer.getAddress(), true);
    await tx.wait();
    console.log("Is allocator set");
    tx = await morphoVault.connect(deployer).submitCap(
        {
            loanToken: "0x8b274AD9CC861eF360c779ce23B26fEb7595A40e",
            collateralToken: "0xc37412747c1000B7400cF9d3fdd905D2B0620B4C",
            oracle: morphoProxyDeployments.MockOracleAddress,
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
            },
            ethers.parseEther("100")
        );
        await tx.wait();
        console.log("Cap submitted");
        const marketParamsId = computeMarketParamsId({
            loanToken: "0x8b274AD9CC861eF360c779ce23B26fEb7595A40e",
            collateralToken: "0xc37412747c1000B7400cF9d3fdd905D2B0620B4C",
            oracle: morphoProxyDeployments.MockOracleAddress,
            irm: morphoTestnetConfig.lrmAddress,
            lltv: ethers.parseEther("0.945")
            });

        tx = await morphoVault.connect(deployer).acceptCap(
            {
                loanToken: "0x8b274AD9CC861eF360c779ce23B26fEb7595A40e",
                collateralToken: "0xc37412747c1000B7400cF9d3fdd905D2B0620B4C",
                oracle: morphoProxyDeployments.MockOracleAddress,
                irm: morphoTestnetConfig.lrmAddress,
                lltv: ethers.parseEther("0.945")
            }
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
