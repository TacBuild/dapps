
export type TreasuryToken = {
    tokenName: string,
    tokenSymbol: string,
    upperBound: bigint,
    lowerBound: bigint,
    decimals: bigint,
    tokenValue: bigint
}

export const treasuryTokens: TreasuryToken[] = [
    {
        tokenName: "tokenName",
        tokenSymbol: "tokenSymbol",
        upperBound: 0n,
        lowerBound: 0n,
        decimals: 18n,
        tokenValue: 100n
    }
]