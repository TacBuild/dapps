const { ethers } = require('hardhat')

const {
    printEvents,
    getContract,
}  = require('../../scripts/utils.js');
const {
    baseSetUp,
    printBalances
} = require('./UniswapV2.utils.js');


async function setUp() {
    // first add liquidity from outside!
}


it("UniswapV2: swapTokensForExactTokens", async()=>{
    await baseSetUp();
    await setUp();

    await printBalances('Balances before action');

    const utilsContract = await getContract('MerkleTreeUtils', 'MerkleTreeUtils');
    const crossChainLayerContract = await getContract('CrossChainLayer', 'CrossChainLayer');
    const groupContract = await getContract('Group', 'Group1');
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');
    const tokenTKAContract = await getContract('CrossChainLayerToken', 'TKA');
    const tokenTKBContract = await getContract('CrossChainLayerToken', 'TKB');

    // message#2: SWAP_EXACT_TOKENS_FOR_TOKENS
    const amountInMax = 10n * 10n**9n;
    const amountOut = 13n * 10n**9n;
    const path = [await tokenTKAContract.getAddress(), await tokenTKBContract.getAddress()];
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;
    const messageSwapTokensForExactTokens = {
        queryId: 124,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
        methodName: 'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
            [amountOut, amountInMax, path, to, deadline]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: await tokenTKAContract.getAddress(), amount: amountInMax},
        ],
        unlock: [],
    };

    // set proper Merkle root for a single message (one leaf tree)
    const messageHash = await utilsContract.hashInMessage(messageSwapTokensForExactTokens)
    console.log('setting Merkle root to ', messageHash)
    console.log('epoch before setting Merkle root:', await groupContract.getCurrentEpoch())

    await groupContract.vote(messageHash)

    // execute message
    console.log('CrossChainLayer execute message')
    const tx = await crossChainLayerContract.receiveMessage(messageSwapTokensForExactTokens, [], 0);
    await printBalances('After call message', tx);

    console.log('\n------------------- Events -------------------\n')
    printEvents(await tx.wait(), crossChainLayerContract);
})
