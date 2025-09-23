export interface LiquidStakingConfig {
  crossChainLayer: string;
  smartAccountFactory: string;
  liquidTacToken: string | null;
  owner: string | null;
}

export const liquidStakingConfig: LiquidStakingConfig = {
  crossChainLayer: "0x9fee01e948353E0897968A3ea955815aaA49f58d",
  smartAccountFactory: "0x070820Ed658860f77138d71f74EfbE173775895b",
  liquidTacToken: null,
  owner: null,
};
