import { ethers } from "ethers";
import { SaHooksBuilder } from "../SaHooksSDK";

// Example ABIs
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)"
];

const NFT_ABI = [
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function setApprovalForAll(address operator, bool approved)"
];

const SWAP_ABI = [
    "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)",
    "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] calldata path, address to, uint256 deadline) returns (uint256[] memory amounts)"
];

async function main() {
    // Example addresses
    const tokenAddress = "0x1234567890123456789012345678901234567890";
    const nftAddress = "0xabcdef1234567890abcdef1234567890abcdef12";
    const spenderAddress = "0x0987654321098765432109876543210987654321";
    const recipientAddress = "0x1111111111111111111111111111111111111111";
    const swapRouterAddress = "0x2222222222222222222222222222222222222222";

    // Create hooks with contract interfaces
    const hooks = new SaHooksBuilder()
        // Add contract interfaces
        .addContractInterface(tokenAddress, ERC20_ABI)
        .addContractInterface(nftAddress, NFT_ABI)
        .addContractInterface(swapRouterAddress, SWAP_ABI)

        // Add pre-hooks using function calls
        .addPreHookCallFromSA(
            tokenAddress,
            "approve",
            [spenderAddress, ethers.parseEther("1.0")]
        )
        .addPreHookCallFromSA(
            tokenAddress,
            "transfer",
            [recipientAddress, ethers.parseEther("0.5")]
        )
        .addPreHookCallFromSA(
            tokenAddress,
            "transferFrom",
            [recipientAddress, spenderAddress, ethers.parseEther("0.1")]
        )

        // Add post-hooks using function calls
        .addPostHookCallFromSelf(
            tokenAddress,
            "balanceOf",
            [recipientAddress]
        )
        .addPostHookCallFromSA(
            nftAddress,
            "setApprovalForAll",
            [spenderAddress, true]
        )

        // Set main call hook (e.g., a swap operation)
        .setMainCallHookCallFromSA(
            swapRouterAddress,
            "swapExactTokensForTokens",
            [
                ethers.parseEther("1.0"), // amountIn
                ethers.parseEther("0.9"), // amountOutMin
                [tokenAddress, recipientAddress], // path
                recipientAddress, // to
                Math.floor(Date.now() / 1000) + 3600 // deadline (1 hour from now)
            ]
        )

        // // Add bridge hooks
        // .addNFTBridgeHook({
        //     isFromSAPerspective: true,
        //     tokenAddress: nftAddress,
        //     tokenId: 1n,
        //     amount: 1n
        // })
        // .addTokenBridgeHook({
        //     isFromSAPerspective: true,
        //     tokenAddress: tokenAddress
        // });

    // Get the built hooks structure
    const builtHooks = hooks.build();
    console.log("Built Hooks:", JSON.stringify(builtHooks, null, 2));

    // Get the encoded hooks
    const encodedHooks = hooks.encode();
    console.log("Encoded Hooks:", encodedHooks);

    // Example of using the encoded hooks with a contract
    /*
    const saHelper = await ethers.getContractAt("SaHelper", "SA_HELPER_ADDRESS");
    
    // Execute pre-hooks
    let tx = await saHelper.executePreHooks("SA_ADDRESS", encodedHooks);
    await tx.wait();
    
    // Execute main call
    tx = await saHelper.executeMainCall("SA_ADDRESS", encodedHooks);
    await tx.wait();
    
    // Execute post-hooks
    tx = await saHelper.executePostHooks("SA_ADDRESS", encodedHooks);
    await tx.wait();
    
    // Execute bridge hooks
    tx = await saHelper.executeBridgeHooks(
        "SA_ADDRESS",
        encodedHooks,
        "0x", // tacHeader
        "payload", // payload
        "CROSS_CHAIN_LAYER_ADDRESS" // crossChainLayer
    );
    await tx.wait();
    */
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}); 