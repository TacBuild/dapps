export interface MidasTestnetConfig {
    depositVaultAddress: string;
    redemptionVaultAddress: string;
    dataFeed: string;
    mToken: string;
}

export const midasTestnetConfig: MidasTestnetConfig = {
    depositVaultAddress: "0x762B366fD2c460f3b08D7CB279140fe39dF2e5Ca",
    redemptionVaultAddress: "0x5E65feDa93CDf3286d4B70BA6d3e2a0e86594CDd",
    dataFeed: "0x7Afed408C766cD90d263d332F6Be70f46BbB4DAe",
    mToken: "0x06A317991F2F479a6213278b32D17a126FcaB501"
};